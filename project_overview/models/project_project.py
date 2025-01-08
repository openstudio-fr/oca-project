import json
import logging
from datetime import datetime, timedelta

import polars as pl

from odoo import _, api, fields, models
from odoo.osv import expression


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
    def get_overview_timesheets_data(self, project_ids, domain=[]):
        projects = self.env["project.project"].browse(project_ids)

        # domain format is ['&', ['date', '>=', '2024-12-01'], '&', ['order_id', 'ilike', '25'], '&', ['date', '<=', '2025-01-07'], ['id', '=', 2]]
        # convert it to real odoo domain
        domain = expression.normalize_domain(domain) if domain else []

        for record in projects:
            tasks_ids = record.task_ids.ids
            tasks = record.task_ids.read(["id", "name"], load=None)

            aal_domain = expression.AND([[("task_id", "in", tasks_ids)], domain])
            analytic_lines = self.env["account.analytic.line"].search_read(
                aal_domain,
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

            # Define periods
            now = datetime.now().date()
            start_months = [
                (now.replace(day=1) - timedelta(days=30 * i)).replace(day=1)
                for i in range(2, -1, -1)
            ]
            month_names = [date.strftime("%b").lower() + "." for date in start_months]

            table_columns = [
                {"id": "name", "name": "Nom"},
                {"id": "before", "name": "Avant"},
                *[{"id": month_name, "name": month_name} for month_name in month_names],
                {"id": "done", "name": "Terminé"},
                {"id": "sold", "name": "Vendu"},
                {"id": "remaining", "name": "Restant"},
            ]

            # If no tasks or no analytic lines, return empty data
            if not tasks or not analytic_lines:
                return json.dumps(
                    {
                        "columns": table_columns,
                        "content": [],
                    }
                )

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

    def get_custom_profitability_items(self):
        self.ensure_one()
        return self._get_profitability_items()
