/** @odoo-module */

import {FormController} from "@web/views/form/form_controller";
import {useService} from "@web/core/utils/hooks";
import {useState, onWillStart} from "@odoo/owl";

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
                this.notification.add("Une erreur est survenue : loadProjectData", {
                    type: "danger",
                });
            }
        } else {
            this.notification.add("Une erreur est survenue : aucun projectId", {
                type: "danger",
            });
        }
    }

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
                this.notification.add("Une erreur est survenue : createInvoice", {
                    type: "danger",
                });
            }
        } else {
            this.notification.add("Une erreur est survenue : aucun projectId", {
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
            this.notification.add("Une erreur est survenue : aucun projectId", {
                type: "danger",
            });
        }
    }
}
