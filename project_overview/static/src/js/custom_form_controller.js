/** @odoo-module */

import {onWillStart, useState} from "@odoo/owl";
import {FormController} from "@web/views/form/form_controller";
import {useService} from "@web/core/utils/hooks";

export class CustomFormController extends FormController {
    async setup() {
        super.setup();

        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");

        this.state = useState({
            showInvoiceButton: false,
            showSaleOrderButton: false,
        });

        onWillStart(() => {
            this.loadProjectData();
        });
    }

    // --------------------------------------------------------------------------
    // API Call
    // --------------------------------------------------------------------------

    async loadProjectData() {
        const projectId = this.props.context.active_id;
        if (projectId) {
            try {
                const projectData = await this.orm.call("project.project", "read", [
                    projectId,
                ]);
                const noSaleOrder = projectData[0].sale_order_count === 0;
                this.state.showSaleOrderButton = noSaleOrder;
                this.state.showInvoiceButton = !noSaleOrder;
            } catch (error) {
                this.notification.add("An error has occurred : loadProjectData", {
                    type: "danger",
                });
            }
        } else {
            this.notification.add("An error has occurred : no projectId", {
                type: "danger",
            });
        }
    }

    // --------------------------------------------------------------------------
    // Action for buttons
    // --------------------------------------------------------------------------

    async createInvoice() {
        this.disableButtons();
        const projectId = this.props.context.active_id;
        if (projectId) {
            try {
                const action = await this.orm.call(
                    "project.project",
                    `action_create_invoice`,
                    [projectId]
                );
                this.action.doAction(action);
            } catch (error) {
                this.notification.add("An error has occurred : createInvoice", {
                    type: "danger",
                });
            }
        } else {
            this.notification.add("An error has occurred : no projectId", {
                type: "danger",
            });
        }

        return null;
    }

    async createSaleOrder() {
        this.disableButtons();
        const projectId = this.props.context.active_id;
        if (projectId) {
            try {
                const action = await this.orm.call(
                    "project.project",
                    "action_create_sale_order",
                    [projectId]
                );
                this.action.doAction(action);
            } catch (error) {
                this.notification.add(error.message, {
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
