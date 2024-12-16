from datetime import datetime, timedelta

from odoo import _, api, fields, models


class ProjectProject(models.Model):
    _inherit = "project.project"

    order_ids = fields.One2many(
        "sale.order", string="Sale Orders", compute="_compute_order_ids"
    )
    widget_field = fields.Char(string="Project Overview Widget")
    overview_data = fields.Json(compute="_compute_overview_data", store=False)

    @api.depends("task_ids")
    def _compute_order_ids(self):
        for project in self:
            project.order_ids = project._fetch_sale_order_items().order_id

    @api.depends()
    def _compute_overview_data(self):
        for record in self:

            now = datetime.now().date()

            # Générer les dates de début et de fin pour les 3 derniers mois
            start_months = [
                (now.replace(day=1) - timedelta(days=30 * i)).replace(day=1)
                for i in range(2, -1, -1)
            ]
            end_months = [
                (start_month.replace(day=1) + timedelta(days=31)).replace(day=1)
                - timedelta(days=1)
                for start_month in start_months
            ]
            month_ids = [date.strftime("%b.").lower() for date in start_months]

            # Colonnes
            columns = [
                {"id": "name", "name": "Nom"},
                {"id": "before", "name": "Avant"},
                *[{"id": month_id, "name": month_id} for month_id in month_ids],
                {"id": "done", "name": "Terminé"},
                {"id": "sold", "name": "Vendu"},
                {"id": "remaining", "name": "Restant"},
            ]

            # Données du projet
            project_data = {
                "name": record.name,
                "id": record.id,
                "before": 0.0,
                month_ids[0]: 0.0,
                month_ids[1]: 0.0,
                month_ids[2]: 0.0,
                "done": 0.0,
                "sold": 0.0,
                "remaining": 0.0,
                "tasks": [],
            }

            total_before = 0.0
            totals_by_month = {month_id: 0.0 for month_id in month_ids}
            total_done = 0.0
            total_sold = 0.0

            for task in record.task_ids:
                task_data = {
                    "name": task.name,
                    "task_id": task.id,
                    "sale_line_id": task.sale_line_id.id,
                    "order_id": task.sale_order_id.id,
                    "before": 0.0,
                    month_ids[0]: 0.0,
                    month_ids[1]: 0.0,
                    month_ids[2]: 0.0,
                    "done": 0.0,
                    "sold": 0.0,
                    "remaining": 0.0,
                    "employees": [],
                }

                task_before = 0.0
                task_by_month = {month_id: 0.0 for month_id in month_ids}
                task_done = 0.0
                task_sold = 0.0

                # Récupération des lignes analytiques
                lines = self.env["account.analytic.line"].search(
                    [
                        ("task_id", "=", task.id),
                    ]
                )
                for line in lines:
                    line_date = line.date
                    if line_date < start_months[0]:
                        task_before += line.unit_amount
                    else:
                        for idx, (start_date, end_date) in enumerate(
                            zip(start_months, end_months)
                        ):
                            if start_date <= line_date <= end_date:
                                month_id = month_ids[idx]
                                task_by_month[month_id] += line.unit_amount

                    task_done += line.unit_amount

                # Heures vendues (relation avec les lignes de commande)
                sale_lines = self.env["sale.order.line"].search(
                    [("task_id", "=", task.id)]
                )
                for sale_line in sale_lines:
                    task_sold += sale_line.product_uom_qty

                # Calcul des heures restantes
                task_remaining = task_sold - task_done

                # Mise à jour des données de la tâche
                task_data["before"] = task_before
                for month_id in month_ids:
                    task_data[month_id] = task_by_month[month_id]
                task_data["done"] = task_done
                task_data["sold"] = task_sold
                task_data["remaining"] = task_remaining

                # Mise à jour des totaux du projet
                total_before += task_before
                for month_id in month_ids:
                    totals_by_month[month_id] += task_by_month[month_id]
                total_done += task_done
                total_sold += task_sold

                # Ajouter les employés
                employees = task.user_ids.mapped("employee_ids")
                for employee in employees:
                    employee_data = {
                        "name": employee.name,
                        "before": 0.0,
                        month_ids[0]: 0.0,
                        month_ids[1]: 0.0,
                        month_ids[2]: 0.0,
                        "done": 0.0,
                        "sold": 0.0,
                        "remaining": 0.0,
                    }
                    task_data["employees"].append(employee_data)

                project_data["tasks"].append(task_data)

            # Calcul des heures restantes au niveau du projet
            total_remaining = total_sold - total_done

            # Mise à jour des totaux dans le projet
            project_data["before"] = total_before
            for month_id in month_ids:
                project_data[month_id] = totals_by_month[month_id]
            project_data["done"] = total_done
            project_data["sold"] = total_sold
            project_data["remaining"] = total_remaining

            # Enregistrement des données générées
            record.overview_data = {
                "columns": columns,
                "content": [project_data],
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

    def action_view_invoices(self):
        # ici il n'y a pas les factures drafs
        # todo: ajouter les filtres
        action = self.env["ir.actions.act_window"]._for_xml_id(
            "sale.action_invoice_salesteams"
        )
        action["display_name"] = _("%(name)s's Invoices", name=self.name)
        action["context"] = {
            "default_project_id": self.id,
            "active_id": self.id,
            "active_model": "account.move",
        }
        return action

    # todo: action_create_sale_order
    # Ouvre la popup de création de bon de commande
    def action_create_sale_order(self):
        action = self.env["ir.actions.actions"]._for_xml_id("sale.action_orders")
        view_form_id = self.env.ref("sale.view_order_form").id
        action["context"] = {
            "views": [(view_form_id, "form")],
            "view_mode": "form",
            "active_id": self.id,
            "res_id": self.id,
        }
        return action

    # def get_overview_data(self):
    #     self.ensure_one()
    #     panel_data = {}
    #     panel_data['profitability_items'] = self._get_profitability_items()
    #     return panel_data
