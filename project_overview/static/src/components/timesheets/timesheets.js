/** @odoo-module **/
import {Component, onWillStart, useState} from "@odoo/owl";
import {useService} from "@web/core/utils/hooks";

export class Timesheets extends Component {
    setup() {
        super.setup();

        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");

        this.openSaleOrder = this.openSaleOrder.bind(this);

        this.state = useState({
            data: null,
            ids: null,
        });

        onWillStart(() => {
            this.loadData();
        });
    }

    async loadData() {
        const data = this.props.record.data.timesheets_field;

        // Todo: ne fonctionne pas car méthode privée
        // const projectId = this.props.record.projectId
        // const action = await this.orm.call(
        //     "project.project",
        //     `_compute_order_ids`,
        //     [projectId]
        // );

        this.state.data = data;
        this.state.ids = (data && data.columns ? data.columns : []).map(
            (column) => column.id
        );
    }

    // Convertir le format d'affichage des heures en hh:mm
    convertToHHMM(timeString) {
        const timeFloat = parseFloat(timeString);
        const hours = Math.floor(timeFloat);
        const minutes = Math.round((timeFloat - hours) * 60);

        const formattedHours = hours.toString().padStart(2, "0");
        const formattedMinutes = minutes.toString().padStart(2, "0");

        return `${formattedHours}:${formattedMinutes}`;
    }

    // Action qui ouvre le détail d'un devis
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
                this.notification.add("Une erreur est survenue : openSaleOrder", {
                    type: "danger",
                });
            }
        }
    }
}

Timesheets.template = "project_overview.Timesheets";
