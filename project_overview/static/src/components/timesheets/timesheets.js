/** @odoo-module **/
import {useService} from "@web/core/utils/hooks";

const {Component, onWillStart, useState} = owl;

export class Timesheets extends Component {
    setup() {
        super.setup();

        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");

        this.openSaleOrder = this.openSaleOrder.bind(this);

        this.state = useState({
            timesheetsData: null,
            columnsId: null,
        });

        onWillStart(() => {
            this.loadTimesheetsData();
        });
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
    // Function for load timesheetsData
    // --------------------------------------------------------------------------

    async loadTimesheetsData() {
        const timesheetsData = this.props.record.data.timesheets_field;

        // Todo: ne fonctionne pas car méthode privée
        // const projectId = this.props.record.projectId
        // const action = await this.orm.call(
        //     "project.project",
        //     `_compute_order_columnsId`,
        //     [projectId]
        // );

        this.state.timesheetsData = timesheetsData;
        this.state.columnsId = (
            timesheetsData && timesheetsData.columns ? timesheetsData.columns : []
        ).map((column) => column.id);
    }

    // --------------------------------------------------------------------------
    // Action for buttons
    // --------------------------------------------------------------------------

    async openSaleOrder(id) {
        const projectId = this.props.record.context.default_project_id;
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
