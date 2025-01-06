/** @odoo-module **/
import {useService} from "@web/core/utils/hooks";

const {Component} = owl;

export class Timesheets extends Component {
    setup() {
        super.setup();

        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");

        this.openSaleOrder = this.openSaleOrder.bind(this);
    }

    // --------------------------------------------------------------------------
    // Getters
    // --------------------------------------------------------------------------

    get timesheets() {
        return this.props.timesheetsData;
    }

    get columnsId() {
        return this.props.columnsId;
    }

    // --------------------------------------------------------------------------
    // Function to convert timesheetsData
    // --------------------------------------------------------------------------

    convertToHHMM(time) {
        const timeFloat = parseFloat(time);
        const hours = Math.floor(timeFloat);
        const minutes = Math.round((timeFloat - hours) * 60);

        const formattedHours = hours.toString().padStart(2, "0");
        const formattedMinutes = minutes.toString().padStart(2, "0");

        return `${formattedHours}:${formattedMinutes}`;
    }

    // --------------------------------------------------------------------------
    // Action for buttons
    // --------------------------------------------------------------------------

    async openSaleOrder(id) {
        const projectId = this.props.projectId;
        if (projectId && id) {
            try {
                const action = await this.orm.call(
                    "project.project",
                    `action_view_one_sale_order`,
                    [projectId, Number(id)]
                );
                this.action.doAction(action);
            } catch (error) {
                this.notification.add("An error has occurred : openSaleOrder", {
                    type: "danger",
                });
            }
        }
    }
}

Timesheets.template = "project_overview.Timesheets";
