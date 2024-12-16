/** @odoo-module **/

import {Component, useState, onWillStart, useRef, useEffect} from "@odoo/owl";
import {TimeByPeople} from "../TimeByPeople/TimeByPeople.js";
import {Dashboard} from "../Dashboard/Dashboard.js";
import {GlobalActions} from "../GlobalActions/GlobalActions.js";
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
                const projectData = await this.orm.call(
                    "project.project",
                    "search_read",
                    [[["id", "=", projectId]], [...Object.keys(fields)]]
                );
                console.log(projectData[0]);
                this.state.projectData = projectData[0];
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
        const filters = this.processData(this.env.searchModel.domain || []);
        if (projectId) {
            try {
                // const fields = await this.orm.call("project.project", 'fields_get');
                const data = await this.orm.call("project.project", "get_panel_data", [
                    [projectId],
                ]);
                console.log(data);
                this.state.profitabilityData = data.profitability_items;
            } catch (error) {
                this.notification.add(error.message, {type: "danger"});
            }
        } else {
            this.notification.add("Une erreur est survenue : aucun projectId", {
                type: "danger",
            });
        }
    }
}

// {context: filters}

ProjectOverviewComponent.template = "project_overview.ProjectOverview";
ProjectOverviewComponent.components = {
    TimeByPeople,
    Dashboard,
    GlobalActions,
};
