/** @odoo-module **/

import {Component, useState, onWillStart} from "@odoo/owl";
import {TimeByPeople} from "../TimeByPeople/TimeByPeople.js";
import {Dashboard} from "../Dashboard/Dashboard.js";
import {GlobalActions} from "../GlobalActions/GlobalActions.js";
import {Timesheets} from "../Timesheets/Timesheets.js";
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
        });

        onWillStart(() => {
            this.loadProjectData();
            this.loadInvoiceTypeData();
            this.loadEmployeesData();
            this.loadProfitabilityData();
            this.loadData();
        });
    }

    // Permet d'obtenir les informations générales du projet "project.project"
    async loadProjectData() {
        const projectId = this.props.record.context.default_project_id;
        if (projectId) {
            try {
                const projectData = await this.orm.call("project.project", "read", [
                    projectId,
                ]);
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
        if (projectId) {
            try {
                const invoiceTypeData = await this.orm.call(
                    "account.analytic.line",
                    "read_group",
                    [
                        [
                            ["project_id", "=", projectId],
                            ["timesheet_invoice_type", "!=", false],
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
        if (projectId) {
            try {
                const data = await this.orm.call(
                    "account.analytic.line",
                    "read_group",
                    [
                        [["project_id", "=", projectId]],
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

    // Permet d'obtenir les informations sur la rentabilité d'un projet "project.project"
    async loadProfitabilityData() {
        const projectId = this.props.record.context.default_project_id;
        if (projectId) {
            try {
                const data = await this.orm.call("project.project", "get_panel_data", [
                    [projectId],
                ]);
                this.state.profitabilityData = data.profitability_items;
            } catch (error) {
                this.notification.add(
                    "Une erreur est survenue : loadProfitabilityData",
                    {type: "danger"}
                );
            }
        } else {
            this.notification.add("Une erreur est survenue : aucun projectId", {
                type: "danger",
            });
        }
    }

    async loadData() {
        const projectId = this.props.record.context.default_project_id;
        if (projectId) {
            try {
                const projectData = await this.orm.call("project.project", "read", [
                    projectId,
                ]);

                // const fields = await this.orm.call("sale.order", "fields_get");
                // console.log(fields);

                const saleOrders = await this.orm.call("sale.order", "search_read", [
                    [],
                    ["id", "name", "project_ids"],
                ]);

                const filteredOrders = saleOrders.filter((order) =>
                    order.project_ids.includes(projectId)
                );

                console.log({
                    count: projectData[0].sale_order_count,
                    ids: projectData[0].sale_order_id,
                    filtered: filteredOrders,
                    all: saleOrders,
                    project: projectData[0],
                });

                // const tasks = await this.orm.call("project.task", "search_read", [
                //     [
                //         ["sale_order_id", "=", filteredOrders[0].id]
                //     ],
                //     ["name", "id"]]
                // );

                // const time = await this.orm.call("account.analytic.line", "search_read", [
                //     [
                //         ["task_id", "=", '545']
                //     ],
                //     ["unit_amount"]]
                // );
            } catch (error) {
                this.notification.add(
                    "Une erreur est survenue : loadProfitabilityData",
                    {type: "danger"}
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
    Timesheets,
};

// const test = await this.orm.call("sale.order.line", "read", [
//     projectId,
// ]);

// const saleOrderItems = await this.orm.call(
//     'project.project',
//     'get_sale_items_data',
//     [projectId],

// );
