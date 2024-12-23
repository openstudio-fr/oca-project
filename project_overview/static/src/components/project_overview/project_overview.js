/** @odoo-module **/

import {Component, useState, onWillStart, useRef, useEffect} from "@odoo/owl";
import {TimeByPeople} from "../time_by_people/time_by_people.js";
import {Dashboard} from "../dashboard/dashboard.js";
import {GlobalActions} from "../global_actions/global_actions.js";
import {useService} from "@web/core/utils/hooks";

export class ProjectOverviewComponent extends Component {
    setup() {
        super.setup();
        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");
        this.state = useState({
            projectData: null,
            invoiceTypeData: null,
            employeesData: null,
            profitabilityData: null,
            prevDomain: null,
            currency: null,
            invoiceIds: null,
        });

        this.searchModel = this.env.searchModel;

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

        onWillStart(() => {
            this.state.prevDomain = this.searchModel.domain;

            this.loadProjectData();
            this.loadInvoiceTypeData();
            this.loadEmployeesData();
            this.loadProfitabilityData();
            this.loadCurrencyData();
        });
    }

    processData = (array) => {
        const filteredData = array.filter((item) => {
            if (Array.isArray(item)) {
                return !(item.includes("type") || item.includes("project_id"));
            }
            return item !== "&" && item !== "|";
        });

        return filteredData.map((item) => {
            if (item[0] === "date_start") {
                return ["date", ">=", item[2]];
            }
            if (item[0] === "date") {
                return ["date", "<=", item[2]];
            }
            if (item[0] === "sale_order_id") {
                return ["order_id", item[1], item[2]];
            }
            return item;
        });
    };

    // Permet d'obtenir les informations générales du projet "project.project"
    async loadProjectData() {
        const projectId = this.props.record.context.default_project_id;
        if (projectId) {
            try {
                const fields = await this.orm.call("project.project", "fields_get");
                // Informations du projet
                const projectData = await this.orm.call(
                    "project.project",
                    "search_read",
                    [[["id", "=", projectId]], [...Object.keys(fields)]]
                );
                this.state.projectData = projectData[0];
                const orderIds = projectData[0].order_ids;

                // Détails des devis
                const saleOrders = await this.orm.call("sale.order", "search_read", [
                    [["id", "in", orderIds]],
                    ["id", "name", "invoice_ids"],
                ]);

                const invoiceIds = saleOrders.map((order) => order.invoice_ids).flat(); // Fusionne tous les tableaux d'invoice_ids en un seul
                this.state.invoiceIds = invoiceIds;
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

    // Permet d'obtenir les informations sur les types de factures "account.analytic.line"
    async loadInvoiceTypeData() {
        const projectId = this.props.record.context.default_project_id;
        const filters = this.processData(this.env.searchModel.domain || []);
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
                this.notification.add("Une erreur est survenue : loadInvoiceTypeData", {
                    type: "danger",
                });
            }
        } else {
            this.notification.add("Une erreur est survenue : aucun projectId", {
                type: "danger",
            });
        }
    }

    // Permet d'obtenir la devise courante
    async loadCurrencyData() {
        const projectId = this.props.record.context.default_project_id;

        if (projectId) {
            try {
                const data = await this.orm.call("account.analytic.line", "read", [
                    projectId,
                ]);
                this.state.currency = data[0].currency_id[1];
            } catch (error) {
                this.notification.add("Une erreur est survenue : loadCurrencyData", {
                    type: "danger",
                });
            }
        } else {
            this.notification.add("Une erreur est survenue : aucun projectId", {
                type: "danger",
            });
        }
    }

    // Permet d'obtenir les informations sur les employées "account.analytic.line"
    async loadEmployeesData() {
        const projectId = this.props.record.context.default_project_id;
        const filters = this.processData(this.env.searchModel.domain || []);
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
                    const employeeId = element["employee_id"][0];
                    const invoiceType = element["timesheet_invoice_type"];

                    let employee = acc.find((e) => e.employeeId === employeeId);
                    if (!employee) {
                        employee = {
                            employeeId: employeeId,
                            name: element["employee_id"][1],
                            invoiceDetails: [],
                            total: 0,
                        };
                        acc.push(employee);
                    }

                    employee.invoiceDetails.push({
                        invoiceType: invoiceType,
                        total: element["unit_amount"],
                    });

                    employee.total += element["unit_amount"];

                    return acc;
                }, []);
                this.state.employeesData = employees;
            } catch (error) {
                this.notification.add("Une erreur est survenue : loadEmployeesData", {
                    type: "danger",
                });
            }
        } else {
            this.notification.add("Une erreur est survenue : aucun projectId", {
                type: "danger",
            });
        }
    }

    // TODO : FILTRE
    // Permet d'obtenir les informations sur la rentabilité d'un projet "project.project"
    async loadProfitabilityData() {
        const projectId = this.props.record.context.default_project_id;

        // Avec processData qui enlève type et projectId :
        const filters = this.processData(this.env.searchModel.domain || []);
        // filters = [
        //     ["order_id", "ilike","21"],
        //     ["date",">=", "2024-01-01"],
        //     ["date", "<=", "2024-12-19"]
        // ]

        // Sans processData :
        // const filters = this.env.searchModel.domain || [];
        // filters = [
        //     "&",
        //     "&",
        //     ["type", "=", "content"],
        //     ["project_id", "=", 8],
        //     "&",
        //     "|",
        //     ["sale_order_id", "ilike", "41"],
        //     ["sale_order_id", "ilike", "77"],
        //     "&",
        //     ["date_start", "=", "2024-12-20"],
        //     ["date", "=", "2024-12-19"],
        // ];
        // dans ce cas, possible d'enlever domains=[(l[0], l[1], l[2]) for l in (filters or [])] dans project_project
        // il faudra peut être enlever type et project_id... je sais pas trop
        if (projectId) {
            try {
                const data = await this.orm.call("project.project", "get_custom_data", [
                    [projectId],
                    filters,
                ]);

                this.state.profitabilityData = data;
            } catch (error) {
                this.notification.add(
                    "Une erreur est survenue : loadProfitabilityData",
                    {
                        type: "danger",
                    }
                );
            }
        } else {
            this.notification.add("Une erreur est survenue : aucun projectId", {
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
