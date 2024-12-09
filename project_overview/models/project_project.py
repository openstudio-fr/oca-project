from odoo import _, fields, models


class ProjectProject(models.Model):
    _inherit = "project.project"

    widget_field = fields.Char(string="Project Overview Widget")

    # Ouvre la page 'Vue s'ensemble'
    def action_project_overview(self):
        action = self.env["ir.actions.act_window"]._for_xml_id(
            "project_overview.action_project_overview"
        )
        action["display_name"] = _("Project Overview")
        action["context"] = {
            "default_project_id": self.id,
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
    def action_project_timesheets_with_filters(self, filter_type):
        self.ensure_one()
        action = self.env["ir.actions.act_window"]._for_xml_id(
            "hr_timesheet.act_hr_timesheet_line_by_project"
        )
        action["display_name"] = _("%(name)s's Timesheets", name=self.name)
        action["domain"] = [("project_id", "=", self.id)]

        filter_key = f"search_default_{filter_type}"
        action["context"] = {
            "default_project_id": self.id,
            "active_id": self.id,
            "active_model": "project.project",
            filter_key: 1,
        }
        return action

    # Ouvre la page 'Fiche de temps' avec quantité fixe facturable
    def action_project_timesheets_billable_fixed(self):
        return self.action_project_timesheets_with_filters("billable_fixed")

    # Ouvre la page 'Fiche de temps' avec temps facturable
    def action_project_timesheets_billable_time(self):
        return self.action_project_timesheets_with_filters("billable_time")

    # Ouvre la page 'Fiche de temps' avec temps non facturable
    def action_project_timesheets_non_billable(self):
        return self.action_project_timesheets_with_filters("non_billable")

    # Ouvre la page 'Fiche de temps' avec temps facturable manuel
    def action_project_timesheets_billable_manual(self):
        return self.action_project_timesheets_with_filters("billable_manual")

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
