/** @odoo-module **/

import {_lt} from "@web/core/l10n/translation";
import {useService} from "@web/core/utils/hooks";

const {Component, useState, useEffect, onWillStart} = owl;

export class Dashboard extends Component {
    setup() {
        super.setup();
        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");

        this.state = useState({
            prevProps: null,
        });

        this.billingData = useState({
            hours: {
                billable_time: 0,
                billable_fixed: 0,
                non_billable: 0,
                billable_manual: 0,
            },
            rates: {},
            totalHours: 0,
        });

        onWillStart(() => {
            this.state.prevProps = JSON.stringify(this.props.invoiceTypeData);
            this.billingDataByType();
        });

        useEffect(
            () => {
                if (
                    this.state.prevProps !== JSON.stringify(this.props.invoiceTypeData)
                ) {
                    this.billingDataByType();
                    this.state.prevProps = JSON.stringify(this.props.invoiceTypeData);
                }
            },
            () => [JSON.stringify(this.props.invoiceTypeData)]
        );
    }

    // --------------------------------------------------------------------------
    // Functions for formatting and converting data
    // --------------------------------------------------------------------------

    formatPriceAsCurrency(price) {
        const currency = this.props.currency || "EUR";
        return (price || 0).toLocaleString("fr-FR", {
            style: "currency",
            currency,
        });
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

    convertToHHMM(timeFloat) {
        const hours = Math.floor(timeFloat);
        const minutes = Math.round((timeFloat - hours) * 60);
        const formattedHours = hours.toString().padStart(2, "0");
        const formattedMinutes = minutes.toString().padStart(2, "0");
        return `${formattedHours}:${formattedMinutes}`;
    }

    // --------------------------------------------------------------------------
    // Function for hours and rates sections
    // --------------------------------------------------------------------------

    billingDataByType() {
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
            data.hours[invoiceType] = this.convertToHHMM(typeHours);

            let rate = 0;
            if (typeHours !== 0 && data.totalHours !== 0) {
                rate = (typeHours / data.totalHours) * 100;
            }

            const floatRate = rate.toFixed(2);
            data.rates[invoiceType] = floatRate;
        });

        data.totalHours = this.convertToHHMM(data.totalHours);
        this.billingData = data;
    }

    // --------------------------------------------------------------------------
    // Getter for profitability section
    // --------------------------------------------------------------------------

    get totalRevenueProfitability() {
        if (
            this.props.profitabilityData &&
            this.props.profitabilityData.revenues &&
            this.props.profitabilityData.revenues.total
        ) {
            return this.props.profitabilityData.revenues.total;
        }
        return {invoiced: 0, to_invoice: 0};
    }

    get totalCostProfitability() {
        if (
            this.props.profitabilityData &&
            this.props.profitabilityData.costs &&
            this.props.profitabilityData.costs.total
        ) {
            return this.props.profitabilityData.costs.total;
        }
        return {billed: 0, to_bill: 0};
    }

    get totalProfitability() {
        const revenues =
            this.props.profitabilityData && this.props.profitabilityData.revenues;
        const costs =
            this.props.profitabilityData && this.props.profitabilityData.costs;
        const totalRevenues = revenues
            ? revenues.total.invoiced + revenues.total.to_invoice
            : 0;
        const totalCosts = costs ? costs.total.billed + costs.total.to_bill : 0;

        return totalRevenues + totalCosts;
    }

    // --------------------------------------------------------------------------
    // Action for buttons
    // --------------------------------------------------------------------------

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
                this.notification.add("An error has occurred : onClickTimesheet", {
                    type: "danger",
                });
            }
        } else {
            this.notification.add("An error has occurred : no projectId", {
                type: "danger",
            });
        }
    }

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
                this.notification.add("An error has occurred : onClickTimesheet", {
                    type: "danger",
                });
            }
        } else {
            this.notification.add("An error has occurred : no projectId", {
                type: "danger",
            });
        }
    }

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
                this.notification.add("An error has occurred : onClickTimesheet", {
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

Dashboard.template = "project_overview.Dashboard";
