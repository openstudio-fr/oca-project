import logging
from collections import defaultdict
from datetime import datetime, timedelta

from odoo import _, api, fields, models

_logger = logging.getLogger(__name__)


class ProjectProject(models.Model):
    _inherit = "project.project"

    order_ids = fields.One2many(
        "sale.order", string="Sale Orders", compute="_compute_order_ids"
    )
    widget_field = fields.Char(string="Project Overview Widget")
    timesheets_field = fields.Json(compute="_compute_timesheets_field", store=False)

    @api.depends("task_ids")
    def _compute_order_ids(self):
        for project in self:
            project.order_ids = project._fetch_sale_order_items().order_id

    @api.depends()
    def _compute_timesheets_field(self):
        for record in self:
            tasks = record.task_ids
            analytic_lines = self.env["account.analytic.line"].search_read(
                [("task_id", "in", tasks.ids)],
                ["task_id", "date", "unit_amount", "user_id"],
                load=None,
            )
            sale_lines = self.env["sale.order.line"].search_read(
                [("task_id", "in", tasks.ids)],
                ["task_id", "product_uom_qty"],
                load=None,
            )
            employees = {
                emp["user_id"]: emp
                for emp in self.env["hr.employee"].search_read(
                    [("user_id", "!=", False)], ["name", "user_id"], load=None
                )
            }

            month_ids, start_months, end_months = self._overview_get_month_dates()

            table_columns = [
                {"id": "name", "name": "Nom"},
                {"id": "before", "name": "Avant"},
                *[{"id": month_id, "name": month_id} for month_id in month_ids],
                {"id": "done", "name": "Terminé"},
                {"id": "sold", "name": "Vendu"},
                {"id": "remaining", "name": "Restant"},
            ]

            orders = defaultdict(lambda: self._overview_create_empty_order(month_ids))
            unordered = self._overview_create_empty_order(
                month_ids, name="Pas de bon de commande"
            )

            for task in tasks:
                task_id = task.id
                task_name = task.name
                task_order_id = task.sale_order_id.id if task.sale_order_id else None
                task_order_name = (
                    task.sale_order_id.name
                    if task.sale_order_id
                    else "Pas de bon de commande"
                )
                task_sale_line_id = task.sale_line_id.id if task.sale_line_id else None

                task_hours = [
                    line for line in analytic_lines if line["task_id"] == task_id
                ]
                task_data = self._overview_initialize_task_data(month_ids)

                employee_data = defaultdict(
                    lambda: self._overview_initialize_task_data(month_ids)
                )

                _logger.debug(
                    "Employee data: %s",
                    "\n".join(str(emp) for emp in employee_data.items()),
                )
                _logger.debug(
                    "Analytic lines: %s",
                    "\n".join(str(line) for line in analytic_lines),
                )
                _logger.debug(
                    "Task hours: %s", "\n".join(str(line) for line in task_hours)
                )

                for line in task_hours:
                    line_date = line["date"]
                    user_id = line["user_id"]

                    _logger.info("User ID: %s", user_id)
                    _logger.info("Employee in employees: %s", user_id in employees)
                    if user_id not in employees:
                        continue

                    if line_date < start_months[0]:
                        task_data["before"] += line["unit_amount"]
                        employee_data[user_id]["before"] += line["unit_amount"]
                    else:
                        for idx, (start_date, end_date) in enumerate(
                            zip(start_months, end_months)
                        ):
                            if start_date <= line_date <= end_date:
                                task_data[month_ids[idx]] += line["unit_amount"]
                                employee_data[user_id][month_ids[idx]] += line[
                                    "unit_amount"
                                ]

                task_data["done"] = sum(line["unit_amount"] for line in task_hours)
                for user_id in employee_data:
                    employee_data[user_id]["done"] = sum(
                        employee_data[user_id][key] for key in month_ids + ["before"]
                    )

                task_sales = [sale for sale in sale_lines if sale["task_id"] == task_id]
                task_data["sold"] = sum(sale["product_uom_qty"] for sale in task_sales)
                for user_id in employee_data:
                    employee_data[user_id]["sold"] = task_data["sold"]

                task_data["remaining"] = task_data["sold"] - task_data["done"]
                for user_id in employee_data:
                    employee_data[user_id]["remaining"] = (
                        employee_data[user_id]["sold"] - employee_data[user_id]["done"]
                    )

                task_employees = [
                    {"name": employees[user_id]["name"], **employee_data[user_id]}
                    for user_id in employee_data
                ]

                target_order = orders[task_order_id] if task_order_id else unordered
                target_order["name"] = task_order_name
                target_order["id"] = task_order_id
                target_order["before"] += task_data["before"]
                for month_id in month_ids:
                    target_order[month_id] += task_data[month_id]
                target_order["done"] += task_data["done"]
                target_order["sold"] += task_data["sold"]
                target_order["remaining"] += task_data["remaining"]

                target_order["sale_lines"].append(
                    {
                        "id": task_sale_line_id,
                        "name": task_name,
                        **task_data,
                        "employees": task_employees,
                    }
                )

            result = []
            for order_id, order_data in orders.items():
                result.append(order_data)
            if unordered["sale_lines"]:
                result.append(unordered)

            record.timesheets_field = {"columns": table_columns, "content": result}

    def _overview_get_month_dates(self):
        now = datetime.now().date()
        start_months = [
            (now.replace(day=1) - timedelta(days=30 * i)).replace(day=1)
            for i in range(2, -1, -1)
        ]
        end_months = [
            (start_month + timedelta(days=31)).replace(day=1) - timedelta(days=1)
            for start_month in start_months
        ]
        month_ids = [date.strftime("%b").lower() + "." for date in start_months]
        return month_ids, start_months, end_months

    def _overview_create_empty_order(self, month_ids, name=""):
        return {
            "id": None,
            "name": name,
            "before": 0.0,
            **{month_id: 0.0 for month_id in month_ids},
            "done": 0.0,
            "sold": 0.0,
            "remaining": 0.0,
            "sale_lines": [],
        }

    def _overview_initialize_task_data(self, month_ids):
        return {
            "before": 0.0,
            **{month_id: 0.0 for month_id in month_ids},
            "done": 0.0,
            "sold": 0.0,
            "remaining": 0.0,
        }

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

    # todo: action_create_sale_order
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

    def get_custom_data(self, filters=None):
        self.ensure_one()
        with_action = False
        # domains=[(l[0], l[1], l[2]) for l in (filters or [])]
        # pb meme le domaine en dur n'est pas utilisé dans _get_profitability_items_from_aal de sale_timesheet project.py
        # malgré domains=None et
        # domain = self.sudo()._get_profitability_aal_domain()
        # if domains is None:
        #     domains = []
        # domain += domains
        return super()._get_profitability_items_from_aal(
            super()._get_profitability_items(with_action),
            with_action,
            domains=[("project_id", "in", [8])],
        )
