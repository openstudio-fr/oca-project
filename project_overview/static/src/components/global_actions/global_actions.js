/** @odoo-module **/

import {useService} from "@web/core/utils/hooks";

const {Component} = owl;

export class GlobalActions extends Component {
    setup() {
        super.setup();

        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");
    }

    // --------------------------------------------------------------------------
    // Getter for task, sale order and invoice count
    // --------------------------------------------------------------------------

    get taskCount() {
        return this.props.taskCount;
    }

    get saleOrderCount() {
        return this.props.saleOrderCount;
    }

    get invoiceCount() {
        return this.props.invoiceIds ? this.props.invoiceIds.length : 0;
    }

    // --------------------------------------------------------------------------
    // Action for buttons
    // --------------------------------------------------------------------------

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
                this.notification.add("An error has occurred : openProject", {
                    type: "danger",
                });
            }
        } else {
            this.notification.add("An error has occurred : no projectId", {
                type: "danger",
            });
        }
    }

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
                this.notification.add("An error has occurred : openTimesheets", {
                    type: "danger",
                });
            }
        } else {
            this.notification.add("An error has occurred : no projectId", {
                type: "danger",
            });
        }
    }

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
                this.notification.add("An error has occurred : openTaskList", {
                    type: "danger",
                });
            }
        } else {
            this.notification.add("An error has occurred : no projectId", {
                type: "danger",
            });
        }
    }

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
                this.notification.add("An error has occurred : openSaleOrder", {
                    type: "danger",
                });
            }
        } else {
            this.notification.add("An error has occurred : no projectId", {
                type: "danger",
            });
        }
    }

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
                this.notification.add("An error has occurred : openInvoices", {
                    type: "danger",
                });
            }
        } else {
            this.notification.add("An error has occurred : no projectId", {
                type: "danger",
            });
        }
    }
}

GlobalActions.template = "project_overview.GlobalActions";
