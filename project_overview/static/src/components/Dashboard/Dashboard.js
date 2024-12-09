/** @odoo-module **/

import {Component, useState, onWillStart} from "@odoo/owl";
import {useService} from "@web/core/utils/hooks";

export class Dashboard extends Component {
    setup() {
        super.setup();

        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");

        this.state = useState({
            data: null,
        });

        onWillStart(() => {
            this.calculateData();
        });
    }

    // Permet d'obtenir les informations de rentabilité - les revenues
    get revenues() {
        return this.props.profitabilityData?.revenues;
    }

    // Permet d'obtenir les informations de rentabilité - les couts
    get costs() {
        return this.props.profitabilityData?.costs;
    }

    // Calcul du total de la rentabilité
    get profitabilityTotal() {
        const revenues = this.props.profitabilityData?.revenues;
        const costs = this.props.profitabilityData?.costs;

        const totalRevenues = revenues.total.invoiced + revenues.total.to_invoice;
        const totalCosts = costs.total.billed + costs.total.to_bill;

        return totalRevenues + totalCosts;
    }

    // Formatter l'affichage de la devise
    formatPriceAsCurrency(price) {
        return price.toLocaleString("fr-FR", {
            style: "currency",
            currency: "EUR",
        });
    }

    // Permet d'obtenir les information sur les heures et les taux
    calculateData() {
        const invoiceTypeData = this.props.invoiceTypeData;
        const data = {
            hours: {},
            rates: {},
            totalHours: 0,
        };

        const convertToHHMM = (timeFloat) => {
            const hours = Math.floor(timeFloat);
            const minutes = Math.round((timeFloat - hours) * 60);
            const formattedHours = hours.toString().padStart(2, "0");
            const formattedMinutes = minutes.toString().padStart(2, "0");
            return `${formattedHours}:${formattedMinutes}`;
        };

        invoiceTypeData?.forEach((timesheet) => {
            const invoiceType = timesheet.timesheet_invoice_type;

            if (!data.hours[invoiceType]) {
                data.hours[invoiceType] = 0;
            }
            data.hours[invoiceType] += timesheet.unit_amount;

            data.totalHours += timesheet.unit_amount;
        });

        Object.keys(data.hours)?.forEach((invoiceType) => {
            const typeHours = data.hours[invoiceType];
            data.hours[invoiceType] = convertToHHMM(typeHours);

            const rate = (typeHours / data.totalHours) * 100;
            const floatRate = rate.toFixed(2);
            data.rates[invoiceType] = floatRate;
        });

        data.totalHours = convertToHHMM(data.totalHours);
        this.state.data = data;
    }

    // Action du bouton "Heures"
    async onClickHoursButton() {
        const projectId = this.props.projectId;
        if (projectId) {
            try {
                const action = await this.orm.call(
                    "project.project",
                    `action_project_timesheet_hours`,
                    [projectId]
                );
                this.action.doAction(action);
            } catch (error) {
                this.notification.add("Une erreur est survenue : onClickTimesheet", {
                    type: "danger",
                });
            }
        } else {
            this.notification.add("Une erreur est survenue : aucun projectId", {
                type: "danger",
            });
        }
    }

    // Action du bouton "Taux"
    async onClickRatesButton() {
        const projectId = this.props.projectId;
        if (projectId) {
            try {
                const action = await this.orm.call(
                    "project.project",
                    `action_project_timesheet_rates`,
                    [projectId]
                );
                this.action.doAction(action);
            } catch (error) {
                this.notification.add("Une erreur est survenue : onClickTimesheet", {
                    type: "danger",
                });
            }
        } else {
            this.notification.add("Une erreur est survenue : aucun projectId", {
                type: "danger",
            });
        }
    }

    // Action du bouton "Rentabilité"
    async onClickProfitabilityButton() {
        const projectId = this.props.projectId;
        if (projectId) {
            try {
                const action = await this.orm.call(
                    "project.project",
                    `action_project_timesheet_profitability`,
                    [projectId]
                );
                this.action.doAction(action);
            } catch (error) {
                this.notification.add("Une erreur est survenue : onClickTimesheet", {
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

Dashboard.template = "project_overview.Dashboard";
