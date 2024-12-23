/** @odoo-module **/

import {Component} from "@odoo/owl";
import {useService} from "@web/core/utils/hooks";

export class GlobalActions extends Component {
    setup() {
        super.setup();

        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");
    }

    // Permet d'obtenir le nombre de tâches
    get taskCount() {
        return this.props.taskCount;
    }

    // Permet d'obtenir le nombre de devis
    get saleOrderCount() {
        return this.props.saleOrderCount;
    }

    // Permet d'obtenir la liste des id des factures
    get invoiceCount() {
        return this.props.invoiceIds ? this.props.invoiceIds.length : 0;
    }

    // Action du bouton "Projet"
    async openProject() {
        const projectId = this.props.projectId;
        if (projectId) {
            try {
                const action = await this.orm.call(
                    "project.project",
                    "action_project_update",
                    [projectId]
                );
                this.action.doAction(action);
            } catch (error) {
                this.notification.add("Une erreur est survenue : openProject", {
                    type: "danger",
                });
            }
        } else {
            this.notification.add("Une erreur est survenue : aucun projectId", {
                type: "danger",
            });
        }
    }

    // Action du bouton "Feuille de temps"
    async openTimesheets() {
        const projectId = this.props.projectId;
        if (projectId) {
            try {
                const action = await this.orm.call(
                    "project.project",
                    "action_project_timesheets",
                    [projectId]
                );
                this.action.doAction(action);
            } catch (error) {
                this.notification.add("Une erreur est survenue : openTimesheets", {
                    type: "danger",
                });
            }
        } else {
            this.notification.add("Une erreur est survenue : aucun projectId", {
                type: "danger",
            });
        }
    }

    // Action du bouton "Tâches"
    async openTaskList() {
        const projectId = this.props.projectId;
        if (projectId) {
            try {
                const action = await this.orm.call(
                    "project.project",
                    "action_view_tasks",
                    [projectId]
                );
                this.action.doAction(action);
            } catch (error) {
                this.notification.add("Une erreur est survenue : openTaskList", {
                    type: "danger",
                });
            }
        } else {
            this.notification.add("Une erreur est survenue : aucun projectId", {
                type: "danger",
            });
        }
    }

    // Action du bouton "Devis"
    async openSaleOrder() {
        const projectId = this.props.projectId;
        if (projectId) {
            try {
                const action = await this.orm.call(
                    "project.project",
                    "action_view_sale_order",
                    [projectId]
                );
                this.action.doAction(action);
            } catch (error) {
                this.notification.add("Une erreur est survenue : openSaleOrder", {
                    type: "danger",
                });
            }
        } else {
            this.notification.add("Une erreur est survenue : aucun projectId", {
                type: "danger",
            });
        }
    }

    // Action du bouton "Facture"
    async openInvoices() {
        const projectId = this.props.projectId;
        const invoiceIds = this.props.invoiceIds;
        if (projectId && invoiceIds && invoiceIds.length > 0) {
            try {
                const action = await this.orm.call(
                    "project.project",
                    "action_view_invoices",
                    [projectId, invoiceIds]
                );
                this.action.doAction(action);
            } catch (error) {
                this.notification.add("Une erreur est survenue : openInvoices", {
                    type: "danger",
                });
            }
        } else {
            this.notification.add("Une erreur est survenue : aucun projectId", {
                type: "danger",
            });
        }
    }
}

GlobalActions.template = "project_overview.GlobalActions";
