import json
import logging
from datetime import datetime, timedelta

import polars as pl

from odoo import _, api, fields, models
from odoo.osv import expression

_logger = logging.getLogger(__name__)


class ProjectProject(models.Model):
    _inherit = "project.project"

    order_ids = fields.One2many(
        "sale.order", string="Sale Orders", compute="_compute_order_ids"
    )
    widget_field = fields.Char(string="Project Overview Widget")

    @api.depends("task_ids")
    def _compute_order_ids(self):
        for project in self:
            project.order_ids = project._fetch_sale_order_items().order_id

    @api.model
    def get_overview_timesheets_data(self, project_ids, domain=None):
        projects = self.env["project.project"].browse(project_ids)

        for record in projects:
            tasks_ids = record.task_ids.ids
            tasks = record.task_ids.read(["id", "name"], load=None)

            analytic_lines = self.env["account.analytic.line"].search_read(
                [("task_id", "in", tasks_ids)],
                ["task_id", "date", "unit_amount", "employee_id"],
                load=None,
            )

            sale_lines = self.env["sale.order.line"].search_read(
                [("task_id", "in", tasks_ids)],
                ["task_id", "name", "product_uom_qty", "order_id"],
                load=None,
            )

            sale_orders = self.env["sale.order"].search_read(
                [("order_line.task_id", "in", tasks_ids)],
                ["id", "name"],
                load=None,
            )

            employees = (
                self.env["hr.employee"]
                .with_context(active_test=False)
                .search_read([], ["id", "name"], load=None)
            )

            # TODO: manage empty data
            tasks_df = pl.from_dicts(tasks)
            analytic_lines_df = pl.from_dicts(analytic_lines)
            sale_lines_df = pl.from_dicts(sale_lines)
            sale_orders_df = pl.from_dicts(sale_orders)
            employees_df = pl.from_dicts(employees)

            global_df = (
                tasks_df.join(
                    analytic_lines_df,
                    left_on="id",
                    right_on="task_id",
                    how="left",
                    suffix="_analytic_line",
                )
                .join(
                    employees_df,
                    left_on="employee_id",
                    right_on="id",
                    how="left",
                    suffix="_employee",
                )
                .join(
                    sale_lines_df,
                    left_on="id",
                    right_on="task_id",
                    how="left",
                    suffix="_sale_line",
                )
                .join(
                    sale_orders_df,
                    left_on="order_id",
                    right_on="id",
                    how="left",
                    suffix="_sale_order",
                )
            )

            # rename columns
            global_df = global_df.rename(
                {
                    "id": "task_id",
                    "name": "task_name",
                    "id_analytic_line": "analytic_line_id",
                    "date": "analytic_line_date",
                    "name_employee": "employee_name",
                    "id_sale_line": "sale_line_id",
                    "name_sale_line": "sale_line_name",
                    "unit_amount": "done",
                    "product_uom_qty": "sold",
                    "name_sale_order": "order_name",
                }
            )

            # Set "Without order" to order name if no order
            global_df = global_df.with_columns(
                pl.col("order_name").replace(None, _("Without order"))
            )

            # Define periods
            now = datetime.now().date()
            start_months = [
                (now.replace(day=1) - timedelta(days=30 * i)).replace(day=1)
                for i in range(2, -1, -1)
            ]
            month_names = [date.strftime("%b").lower() + "." for date in start_months]

            # Initialize period columns with default values
            for col in ["before"] + month_names:
                global_df = global_df.with_columns(pl.lit(0.0).alias(col))

            # Define conditions for each period
            conditions = [
                (pl.col("analytic_line_date") < start_months[0], "before"),
                (
                    (pl.col("analytic_line_date") >= start_months[0])
                    & (pl.col("analytic_line_date") < start_months[1]),
                    month_names[0],
                ),
                (
                    (pl.col("analytic_line_date") >= start_months[1])
                    & (pl.col("analytic_line_date") < start_months[2]),
                    month_names[1],
                ),
                (pl.col("analytic_line_date") >= start_months[2], month_names[2]),
            ]

            # Update period columns based on conditions
            for condition, column in conditions:
                global_df = global_df.with_columns(
                    pl.when(condition)
                    .then(pl.col("done"))
                    .otherwise(pl.col(column))
                    .alias(column)
                )

            """
            # TODO: It should be possible to do this in one step

            # Add periods columns to the dataframe
            global_df = global_df.with_columns(
                pl.when(pl.col("analytic_line_date") < start_months[0])
                .then("before")
                .when(
                    (pl.col("analytic_line_date") >= start_months[0])
                    & (pl.col("analytic_line_date") < start_months[1])
                )
                .then(month_names[0])
                .when(
                    (pl.col("analytic_line_date") >= start_months[1])
                    & (pl.col("analytic_line_date") < start_months[2])
                )
                .then(month_names[1])
                .when(pl.col("analytic_line_date") >= start_months[2])
                .then(month_names[2])
            )
            """

            # By order df
            by_order_df = global_df.group_by("order_id").agg(
                pl.first("order_name"),
                pl.sum("before"),
                pl.sum(month_names[0]),
                pl.sum(month_names[1]),
                pl.sum(month_names[2]),
                pl.sum("done"),
                pl.sum("sold"),
            )

            # Add remaining column
            by_order_df = by_order_df.with_columns(
                (pl.col("sold") - pl.col("done")).alias("remaining")
            ).rename({"order_id": "id", "order_name": "name"})

            # by task df
            by_task_df = global_df.group_by("task_id").agg(
                pl.first("task_name"),
                pl.first("order_id"),
                pl.first("order_name"),
                pl.first("sale_line_id"),
                pl.first("sale_line_name"),
                pl.sum("before"),
                pl.sum(month_names[0]),
                pl.sum(month_names[1]),
                pl.sum(month_names[2]),
                pl.sum("done"),
                pl.sum("sold"),
            )

            # Add name column, use task_name if no sale_line_name
            by_task_df = by_task_df.with_columns(
                pl.when(pl.col("sale_line_name").is_null())
                .then(pl.col("task_name"))
                .otherwise(pl.col("sale_line_name"))
                .alias("name")
            )

            # Add remaining column
            by_task_df = by_task_df.with_columns(
                (pl.col("sold") - pl.col("done")).alias("remaining")
            )

            # By task and employee df
            by_task_employee_df = (
                global_df.group_by("task_id", "employee_id")
                .agg(
                    pl.first("employee_name"),
                    pl.sum("before"),
                    pl.sum(month_names[0]),
                    pl.sum(month_names[1]),
                    pl.sum(month_names[2]),
                    pl.sum("done"),
                )
                .filter(pl.col("done") != 0)
            ).rename({"employee_name": "name"})

            table_columns = [
                {"id": "name", "name": "Nom"},
                {"id": "before", "name": "Avant"},
                *[{"id": month_name, "name": month_name} for month_name in month_names],
                {"id": "done", "name": "Terminé"},
                {"id": "sold", "name": "Vendu"},
                {"id": "remaining", "name": "Restant"},
            ]

            # generate table content
            orders = by_order_df.to_dicts()
            for order in orders:
                order["sale_lines"] = by_task_df.filter(
                    pl.col("order_name") == order["name"]
                ).to_dicts()
                for sale_line in order["sale_lines"]:
                    sale_line["employees"] = by_task_employee_df.filter(
                        pl.col("task_id") == sale_line["task_id"]
                    ).to_dicts()

            table_content = orders

            return json.dumps(
                {
                    "columns": table_columns,
                    "content": table_content,
                }
            )

    # Ouvre la page 'Vue s'ensemble'
    def action_project_overview(self):
        self.ensure_one()
        action = self.env["ir.actions.act_window"]._for_xml_id(
            "project_overview.action_project_overview"
        )
        action["display_name"] = _("Project Overview")
        action["context"] = {
            "default_project_id": self.id,
            "active_id": self.id,
        }
        action["res_id"] = self.id
        return action

    # Ouvre la page 'Fiche de temps'
    def action_project_timesheets(self):
        self.ensure_one()
        action = self.env["ir.actions.act_window"]._for_xml_id(
            "hr_timesheet.act_hr_timesheet_line_by_project"
        )
        action["display_name"] = _("%(name)s's Timesheets", name=self.name)
        action["context"] = {
            "default_project_id": self.id,
            "active_id": self.id,
            "active_model": "project.project",
        }
        return action

    # Ouvre la page 'Tâches'
    def action_view_tasks(self):
        action = self.env["ir.actions.act_window"]._for_xml_id(
            "project.act_project_project_2_project_task_all"
        )
        action["display_name"] = _("%(name)s's Tasks", name=self.name)
        action["context"].replace("active_id", str(self.id))
        action["context"] = {
            "default_project_id": self.id,
            "active_id": self.id,
            "active_model": "project.project",
        }
        return action

    # Ouvre la page 'Projet'
    def action_project_update(self):
        action = self.env["ir.actions.act_window"]._for_xml_id(
            "project.project_update_all_action"
        )
        action["display_name"] = _("%(name)s's Project", name=self.name)
        action["context"] = {
            "default_project_id": self.id,
            "active_id": self.id,
            "active_model": "project.project",
        }
        return action

    # Ouvre la page 'Devis'
    def action_view_sale_order(self):
        self.ensure_one()
        all_sale_orders = self._fetch_sale_order_items(
            {"project.task": [("is_closed", "=", False)]}
        ).order_id
        action_window = {
            "type": "ir.actions.act_window",
            "res_model": "sale.order",
            "name": _("%(name)s's Sales Order", name=self.name),
            "context": {"create": False, "show_sale": True},
        }
        if len(all_sale_orders) == 1:
            action_window.update(
                {
                    "res_id": all_sale_orders.id,
                    "views": [[False, "form"]],
                }
            )
        else:
            action_window.update(
                {
                    "domain": [("id", "in", all_sale_orders.ids)],
                    "views": [
                        [False, "tree"],
                        [False, "kanban"],
                        [False, "calendar"],
                        [False, "pivot"],
                        [False, "graph"],
                        [False, "activity"],
                        [False, "form"],
                    ],
                }
            )
        return action_window

    # Ouvre la page 'Fiche de temps' avec un filtre
    def action_project_timesheets_with_filters(self, filterType):
        self.ensure_one()
        action = self.env["ir.actions.act_window"]._for_xml_id(
            "hr_timesheet.act_hr_timesheet_line_by_project"
        )
        action["display_name"] = _("%(name)s's Timesheets", name=self.name)
        action["domain"] = [("project_id", "=", self.id)]

        filter_key = f"search_default_{filterType}"
        action["context"] = {
            "default_project_id": self.id,
            "active_id": self.id,
            "active_model": "project.project",
            filter_key: 1,
        }
        return action

    # Ouvre la page 'Fiche de temps' d'un employé spécifique
    def action_employee_timesheets(self, employeeId):
        self.ensure_one()
        action = self.env["ir.actions.act_window"]._for_xml_id(
            "hr_timesheet.act_hr_timesheet_line_by_project"
        )
        action["display_name"] = _("%(name)s's Timesheets", name=self.name)
        action["context"] = {
            "default_project_id": self.id,
            "active_id": self.id,
            "active_model": "project.project",
            "search_default_employee_id": [employeeId],
        }
        return action

    # Ouvre la page 'Fiche de temps' en pivot avec les heures et type de facturation
    def action_project_timesheet_hours(self):
        self.ensure_one()
        action = self.env["ir.actions.act_window"]._for_xml_id(
            "hr_timesheet.act_hr_timesheet_line_by_project"
        )
        action["display_name"] = _("%(name)s's Timesheets", name=self.name)
        action["domain"] = [("project_id", "=", self.id)]
        action["views"] = [[False, "pivot"]]
        action["context"] = {
            "default_project_id": self.id,
            "active_id": self.id,
            "active_model": "project.project",
            "pivot_row_groupby": ["date:month"],
            "pivot_column_groupby": ["timesheet_invoice_type"],
            "pivot_measures": ["unit_amount"],
        }
        return action

    # Ouvre la page 'Fiche de temps' en pivot avec les taux et type de facturation
    def action_project_timesheet_rates(self):
        self.ensure_one()
        action = self.env["ir.actions.act_window"]._for_xml_id(
            "hr_timesheet.act_hr_timesheet_line_by_project"
        )
        action["display_name"] = _("%(name)s's Timesheets", name=self.name)
        action["domain"] = [("project_id", "=", self.id)]
        action["views"] = [[False, "pivot"]]
        action["context"] = {
            "default_project_id": self.id,
            "active_id": self.id,
            "active_model": "project.project",
            "pivot_row_groupby": ["date:month", "employee_id"],
            "pivot_column_groupby": ["timesheet_invoice_type"],
            "pivot_measures": ["unit_amount"],
        }
        return action

    # Ouvre la page 'Fiche de temps' en pivot avec la rentabilité et type de facturation
    def action_project_timesheet_profitability(self):
        self.ensure_one()
        action = self.env["ir.actions.act_window"]._for_xml_id(
            "hr_timesheet.act_hr_timesheet_line_by_project"
        )
        action["display_name"] = _("%(name)s's Timesheets", name=self.name)
        action["domain"] = [("project_id", "=", self.id)]
        action["views"] = [[False, "pivot"]]
        action["context"] = {
            "default_project_id": self.id,
            "active_id": self.id,
            "active_model": "project.project",
            "pivot_row_groupby": ["timesheet_invoice_id"],
            "pivot_column_groupby": ["date:month"],
            "pivot_measures": ["amount"],
        }
        return action

    # Ouvre la page d'un devis
    def action_view_one_sale_order(self, id):
        self.ensure_one()
        action_window = {
            "type": "ir.actions.act_window",
            "res_model": "sale.order",
            "name": _("%(name)s's Sales Order", name=self.name),
            "context": {"create": False, "show_sale": True},
            "res_id": id,
            "views": [[False, "form"]],
        }
        return action_window

    # Ouvre la popup de création de facture
    def action_create_invoice(self):
        action = self.env["ir.actions.actions"]._for_xml_id(
            "sale.action_view_sale_advance_payment_inv"
        )
        so_ids = (
            (self.sale_order_id | self.task_ids.sale_order_id)
            .filtered(lambda so: so.invoice_status in ["to invoice", "no"])
            .ids
        )
        action["context"] = {
            "active_id": so_ids[0] if len(so_ids) == 1 else False,
            "active_ids": so_ids,
        }
        if not self.has_any_so_to_invoice:
            action["context"]["default_advance_payment_method"] = "percentage"
        return action

    # todo: optimisé pour faire qu'une requete, si employeeId
    # Ouvre la page 'Fiche de temps' avec un type de temps et un employé
    def action_project_timesheets_with_all_filters(self, employeeId, invoiceType):
        self.ensure_one()
        action = self.env["ir.actions.act_window"]._for_xml_id(
            "hr_timesheet.act_hr_timesheet_line_by_project"
        )
        action["display_name"] = _("%(name)s's Timesheets", name=self.name)
        action["domain"] = [("project_id", "=", self.id)]

        filter_key = f"search_default_{invoiceType}"
        action["context"] = {
            "default_project_id": self.id,
            "active_id": self.id,
            "active_model": "project.project",
            "search_default_employee_id": [employeeId],
            filter_key: 1,
        }
        return action

    # Ouvrir la vue "Factures"
    def action_view_invoices(self, invoicesIds):
        action = {
            "type": "ir.actions.act_window",
            "res_model": "account.move",
            "name": _("%(name)s's Invoices", name=self.name),
            "context": {"create": False},
        }

        if len(invoicesIds) == 1:
            action.update(
                {
                    "res_id": invoicesIds[0],
                    "views": [[False, "form"]],
                }
            )
        else:
            action.update(
                {
                    "domain": [("id", "in", invoicesIds)],
                    "views": [
                        [False, "tree"],
                        [False, "form"],
                    ],
                }
            )

        return action

    # Ouvre la popup de création de bon de commande
    def action_create_sale_order(self):
        view_form_id = self.env.ref("sale.view_order_form").id
        return {
            "type": "ir.actions.act_window",
            "name": _("%(name)s's Quotation", name=self.name),
            "res_model": "sale.order",
            "view_mode": "form",
            "views": [(view_form_id, "form")],
            "target": "current",
            "context": {
                "default_project_id": self.id,
            },
        }

    def get_custom_profitability_sequence_per_invoice_type(self):
        return {
            **super()._get_profitability_sequence_per_invoice_type(),
            "billable_fixed": 1,
            "billable_time": 2,
            "billable_milestones": 3,
            "billable_manual": 4,
            "non_billable": 5,
            "timesheet_revenues": 6,
            "other_costs": 12,
        }

    def _get_custom_profitability_aal_domain(self, extra_domain=None):
        domain = [
            "|",
            ("project_id", "in", self.ids),
            ("so_line", "in", self._fetch_sale_order_item_ids()),
        ]

        initial_domain = expression.AND(
            [
                super()._get_profitability_aal_domain(),
                domain,
            ]
        )

        if extra_domain:
            return expression.AND([initial_domain, extra_domain])

        return initial_domain

    def get_profitability_items_from_aal_custom(
        self, profitability_items, with_action=True, extra_domain=None
    ):
        if not self.allow_timesheets:
            total_invoiced = total_to_invoice = 0.0
            revenue_data = []
            for revenue in profitability_items["revenues"]["data"]:
                if revenue["id"] in [
                    "billable_fixed",
                    "billable_time",
                    "billable_milestones",
                    "billable_manual",
                ]:
                    continue
                total_invoiced += revenue["invoiced"]
                total_to_invoice += revenue["to_invoice"]
                revenue_data.append(revenue)
            profitability_items["revenues"] = {
                "data": revenue_data,
                "total": {"to_invoice": total_to_invoice, "invoiced": total_invoiced},
            }
            return profitability_items

        test = self.sudo()._get_custom_profitability_aal_domain(extra_domain)

        aa_line_read_group = (
            self.env["account.analytic.line"]
            .sudo()
            ._read_group(
                test,
                [
                    "timesheet_invoice_type",
                    "timesheet_invoice_id",
                    "unit_amount",
                    "amount",
                    "ids:array_agg(id)",
                ],
                ["timesheet_invoice_type", "timesheet_invoice_id"],
                lazy=False,
            )
        )

        can_see_timesheets = (
            with_action
            and len(self) == 1
            and self.user_has_groups("hr_timesheet.group_hr_timesheet_approver")
        )
        revenues_dict = {}
        costs_dict = {}
        total_revenues = {"invoiced": 0.0, "to_invoice": 0.0}
        total_costs = {"billed": 0.0, "to_bill": 0.0}
        for res in aa_line_read_group:
            amount = res["amount"]
            invoice_type = res["timesheet_invoice_type"]
            cost = costs_dict.setdefault(invoice_type, {"billed": 0.0, "to_bill": 0.0})
            revenue = revenues_dict.setdefault(
                invoice_type, {"invoiced": 0.0, "to_invoice": 0.0}
            )
            if amount < 0:  # cost
                cost["billed"] += amount
                total_costs["billed"] += amount
            else:  # revenues
                revenue["invoiced"] += amount
                total_revenues["invoiced"] += amount
            if can_see_timesheets and invoice_type not in [
                "other_costs",
                "other_revenues",
            ]:
                cost.setdefault("record_ids", []).extend(res["ids"])
                revenue.setdefault("record_ids", []).extend(res["ids"])

        action_name = None
        if can_see_timesheets:
            action_name = "action_profitability_items"

        def get_timesheets_action(invoice_type, record_ids):
            args = [invoice_type, [("id", "in", record_ids)]]
            if len(record_ids) == 1:
                args.append(record_ids[0])
            return {"name": action_name, "type": "object", "args": json.dumps(args)}

        sequence_per_invoice_type = (
            self.get_custom_profitability_sequence_per_invoice_type()
        )

        def convert_dict_into_profitability_data(d, cost=True):
            profitability_data = []
            key1, key2 = ["to_bill", "billed"] if cost else ["to_invoice", "invoiced"]
            for invoice_type, vals in d.items():
                if not vals[key1] and not vals[key2]:
                    continue
                record_ids = vals.pop("record_ids", [])
                data = {
                    "id": invoice_type,
                    "sequence": sequence_per_invoice_type[invoice_type],
                    **vals,
                }
                if record_ids:
                    if (
                        invoice_type not in ["other_costs", "other_revenues"]
                        and can_see_timesheets
                    ):  # action to see the timesheets
                        action = get_timesheets_action(invoice_type, record_ids)
                        action["context"] = json.dumps(
                            {
                                "search_default_groupby_invoice": 1
                                if not cost and invoice_type == "billable_time"
                                else 0
                            }
                        )
                        data["action"] = action
                profitability_data.append(data)
            return profitability_data

        def merge_profitability_data(a, b):
            return {
                "data": a["data"] + b["data"],
                "total": {
                    key: a["total"][key] + b["total"][key]
                    for key in a["total"].keys()
                    if key in b["total"]
                },
            }

        for revenue in profitability_items["revenues"]["data"]:
            revenue_id = revenue["id"]
            aal_revenue = revenues_dict.pop(revenue_id, {})
            revenue["to_invoice"] += aal_revenue.get("to_invoice", 0.0)
            revenue["invoiced"] += aal_revenue.get("invoiced", 0.0)
            record_ids = aal_revenue.get("record_ids", [])
            if can_see_timesheets and record_ids:
                action = get_timesheets_action(revenue_id, record_ids)
                action["context"] = json.dumps(
                    {
                        "search_default_groupby_invoice": 1
                        if revenue_id == "billable_time"
                        else 0
                    }
                )
                revenue["action"] = action

        for cost in profitability_items["costs"]["data"]:
            cost_id = cost["id"]
            aal_cost = costs_dict.pop(cost_id, {})
            cost["to_bill"] += aal_cost.get("to_bill", 0.0)
            cost["billed"] += aal_cost.get("billed", 0.0)
            record_ids = aal_cost.get("record_ids", [])
            if can_see_timesheets and record_ids:
                cost["action"] = get_timesheets_action(cost_id, record_ids)

        profitability_items["revenues"] = merge_profitability_data(
            profitability_items["revenues"],
            {
                "data": convert_dict_into_profitability_data(revenues_dict, False),
                "total": total_revenues,
            },
        )
        profitability_items["costs"] = merge_profitability_data(
            profitability_items["costs"],
            {
                "data": convert_dict_into_profitability_data(costs_dict),
                "total": total_costs,
            },
        )
        return profitability_items

    def get_custom_profitability_items(self, domain=None, with_action=True):
        extra_domain = [(l[0], l[1], l[2]) for l in (domain or [])]
        return self.get_profitability_items_from_aal_custom(
            super()._get_profitability_items(with_action), with_action, extra_domain
        )
