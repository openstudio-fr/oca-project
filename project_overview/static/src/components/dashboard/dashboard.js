/** @odoo-module **/

import {_lt} from "@web/core/l10n/translation";
import {useService} from "@web/core/utils/hooks";

const {Component} = owl;

export class Dashboard extends Component {
    setup() {
        super.setup();
        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");
    }

    // Permet d'obtenir les informations de rentabilité - les revenues
    get revenues() {
        return (
            (this.props.profitabilityData && this.props.profitabilityData.revenues) || {
                data: [],
                total: {
                    invoiced: 0,
                    to_invoice: 0,
                },
            }
        );
    }

    // Permet d'obtenir les informations de rentabilité - les couts
    get costs() {
        return (
            (this.props.profitabilityData && this.props.profitabilityData.costs) || {
                data: [],
                total: {
                    billed: 0,
                    to_bill: 0,
                },
            }
        );
    }

    // Calcul du total de la rentabilité
    get profitabilityTotal() {
        const revenues =
            this.props &&
            this.props.profitabilityData &&
            this.props.profitabilityData.revenues;
        const costs =
            this.props &&
            this.props.profitabilityData &&
            this.props.profitabilityData.costs;
        const totalRevenues = revenues
            ? revenues.total.invoiced + revenues.total.to_invoice
            : 0;
        const totalCosts = costs ? costs.total.billed + costs.total.to_bill : 0;

        return totalRevenues + totalCosts;
    }

    // Todo: à optimiser car bcp de rendu (state mais pb de rendu avec filtres)
    // Permet d'obtenir les information sur les heures et les taux
    get allData() {
        const invoiceTypeData = this.props.invoiceTypeData;
        const data = {
            hours: {
                billable_time: 0,
                billable_fixed: 0,
                non_billable: 0,
                billable_manual: 0,
            },
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

        (invoiceTypeData || []).forEach((timesheet) => {
            const invoiceType = timesheet.timesheet_invoice_type;

            if (!data.hours[invoiceType]) {
                data.hours[invoiceType] = 0;
            }
            data.hours[invoiceType] += timesheet.unit_amount;

            data.totalHours += timesheet.unit_amount;
        });

        (Object.keys(data.hours) || []).forEach((invoiceType) => {
            const typeHours = data.hours[invoiceType];
            data.hours[invoiceType] = convertToHHMM(typeHours);

            let rate = 0;
            if (typeHours !== 0 && data.totalHours !== 0) {
                rate = (typeHours / data.totalHours) * 100;
            }

            const floatRate = rate.toFixed(2);
            data.rates[invoiceType] = floatRate;
        });

        data.totalHours = convertToHHMM(data.totalHours);
        return data;
    }

    // Formatter l'affichage de la devise
    formatPriceAsCurrency(price) {
        const currency = this.props.currency;
        return (price || 0).toLocaleString("fr-FR", {
            style: "currency",
            currency,
        });
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

    formatName(field) {
        switch (field) {
            case "billable_time":
                return _lt("Billable time");
            case "billable_fixed":
                return _lt("Billable fixed");
            case "non_billable":
                return _lt("Non billable");
            case "billable_manual":
                return _lt("Billable manual");
            case "invoiced":
                return _lt("Invoiced");
            case "to_invoice":
                return _lt("To invoice");
            case "billed":
                return _lt("Re-invoiced costs");
            case "to_bill":
                return _lt("Costs");
            default:
                return field.replace("_", " ");
        }
    }
}

Dashboard.template = "project_overview.Dashboard";
