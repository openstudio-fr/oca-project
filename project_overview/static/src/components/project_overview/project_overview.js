/** @odoo-module **/

import {useService} from "@web/core/utils/hooks";
import {Dashboard} from "../dashboard/dashboard.js";
import {GlobalActions} from "../global_actions/global_actions.js";
import {TimeByPeople} from "../time_by_people/time_by_people.js";

const {Component, onWillStart, useEffect, useState} = owl;

export class ProjectOverviewComponent extends Component {
    setup() {
        super.setup();
        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");

        this.searchModel = this.env.searchModel;

        this.state = useState({
            projectData: null,
            invoiceTypeData: null,
            employeesData: null,
            profitabilityData: null,
            prevDomain: null,
            currency: null,
            invoiceIds: null,
        });

        onWillStart(() => {
            this.state.prevDomain = this.searchModel.domain;

            this.loadProjectData();
            this.loadInvoiceTypeData();
            this.loadEmployeesData();
            this.loadProfitabilityData();
            this.loadCurrencyData();
        });

        useEffect(() => {
            const currentDomain = this.searchModel.domain;

            if (
                !this.state.prevDomain ||
                JSON.stringify(this.state.prevDomain) !== JSON.stringify(currentDomain)
            ) {
                this.loadInvoiceTypeData();
                this.loadEmployeesData();
                this.loadProfitabilityData();
                this.state.prevDomain = currentDomain;
            }
        });
    }

    // --------------------------------------------------------------------------
    // Function to format filters
    // --------------------------------------------------------------------------

    formatFilters(array) {
        const newArray = [...array];

        ["type", "project_id"].forEach((key) => {
            if (newArray.some((item) => Array.isArray(item) && item[0] === key)) {
                newArray.shift();
            }
        });

        const filteredData = newArray.filter((item) => {
            return !(
                Array.isArray(item) &&
                ["type", "project_id"].some((key) => item.includes(key))
            );
        });

        return filteredData.map((item) => {
            if (Array.isArray(item)) {
                switch (item[0]) {
                    case "date_start":
                        return ["date", ">=", item[2]];
                    case "date":
                        return ["date", "<=", item[2]];
                    case "sale_order_id":
                        return ["order_id", item[1], item[2]];
                    default:
                        return item;
                }
            }
            return item;
        });
    }

    // --------------------------------------------------------------------------
    // API Calls
    // --------------------------------------------------------------------------

    async loadProjectData() {
        const projectId = this.props.record.context.default_project_id;
        if (projectId) {
            try {
                const fields = await this.orm.call("project.project", "fields_get");
                const projectData = await this.orm.call(
                    "project.project",
                    "search_read",
                    [[["id", "=", projectId]], [...Object.keys(fields)]]
                );
                this.state.projectData = projectData[0];
                const orderIds = projectData[0].order_ids;
                const saleOrders = await this.orm.call("sale.order", "search_read", [
                    [["id", "in", orderIds]],
                    ["id", "name", "invoice_ids"],
                ]);

                const invoiceIds = saleOrders.map((order) => order.invoice_ids).flat();
                this.state.invoiceIds = invoiceIds;
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

    async loadInvoiceTypeData() {
        const projectId = this.props.record.context.default_project_id;
        const filters = this.formatFilters(this.env.searchModel.domain || []);
        if (projectId) {
            try {
                const invoiceTypeData = await this.orm.call(
                    "account.analytic.line",
                    "read_group",
                    [
                        [
                            ["project_id", "=", projectId],
                            ["timesheet_invoice_type", "!=", false],
                            ...filters,
                        ],
                        ["unit_amount", "timesheet_invoice_type", "amount"],
                        ["timesheet_invoice_type"],
                    ]
                );
                this.state.invoiceTypeData = invoiceTypeData;
            } catch (error) {
                this.notification.add("An error has occurred : loadInvoiceTypeData", {
                    type: "danger",
                });
            }
        } else {
            this.notification.add("An error has occurred : no projectId", {
                type: "danger",
            });
        }
    }

    async loadCurrencyData() {
        const projectId = this.props.record.context.default_project_id;

        if (projectId) {
            try {
                const data = await this.orm.call("account.analytic.line", "read", [
                    projectId,
                ]);
                this.state.currency = data[0].currency_id[1];
            } catch (error) {
                this.notification.add("An error has occurred : loadCurrencyData", {
                    type: "danger",
                });
            }
        } else {
            this.notification.add("An error has occurred : no projectId", {
                type: "danger",
            });
        }
    }

    async loadEmployeesData() {
        const projectId = this.props.record.context.default_project_id;
        const filters = this.formatFilters(this.env.searchModel.domain || []);
        if (projectId) {
            try {
                const data = await this.orm.call(
                    "account.analytic.line",
                    "read_group",
                    [
                        [["project_id", "=", projectId], ...filters],
                        ["employee_id", "timesheet_invoice_type", "unit_amount"],
                        ["employee_id", "timesheet_invoice_type"],
                    ],
                    {lazy: false}
                );
                const employees = (data || []).reduce((acc, element) => {
                    const employeeId = element.employee_id[0];
                    const invoiceType = element.timesheet_invoice_type;

                    let employee = acc.find((e) => e.employeeId === employeeId);
                    if (!employee) {
                        employee = {
                            employeeId: employeeId,
                            name: element.employee_id[1],
                            invoiceDetails: [],
                            total: 0,
                        };
                        acc.push(employee);
                    }

                    employee.invoiceDetails.push({
                        invoiceType: invoiceType,
                        total: element.unit_amount,
                    });

                    employee.total += element.unit_amount;

                    return acc;
                }, []);
                this.state.employeesData = employees;
            } catch (error) {
                this.notification.add("An error has occurred : loadEmployeesData", {
                    type: "danger",
                });
            }
        } else {
            this.notification.add("An error has occurred : no projectId", {
                type: "danger",
            });
        }
    }

    // TODO : FILTRE
    async loadProfitabilityData() {
        const projectId = this.props.record.context.default_project_id;

        // Avec formatFilters qui enlève type et projectId :
        const filters = this.formatFilters(this.env.searchModel.domain || []);
        // Filters = [
        //     "&",
        //     [
        //         "date",
        //         ">=",
        //         "2024-01-01"
        //     ],
        //     "&",
        //     [
        //         "date",
        //         "<=",
        //         "2025-01-02"
        //     ],
        //     "|",
        //     [
        //         "order_id",
        //         "ilike",
        //         "21"
        //     ],
        //     [
        //         "order_id",
        //         "ilike",
        //         "22"
        //     ]
        // ]

        // Sans formatFilters :
        // type project_id sale_order_id date_start date
        // dans ce cas, possible d'enlever domains=[(l[0], l[1], l[2]) for l in (filters or [])] dans project_project
        if (projectId) {
            try {
                const data = await this.orm.call("project.project", "get_custom_data", [
                    [projectId],
                    filters,
                ]);

                this.state.profitabilityData = data;
            } catch (error) {
                this.notification.add("An error has occurred : loadProfitabilityData", {
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

ProjectOverviewComponent.template = "project_overview.ProjectOverview";
ProjectOverviewComponent.components = {
    TimeByPeople,
    Dashboard,
    GlobalActions,
};
