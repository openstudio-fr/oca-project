/** @odoo-module **/

import {useService} from "@web/core/utils/hooks";

const {Component} = owl;

export class TimeByPeople extends Component {
    setup() {
        super.setup();

        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");

        this.onClickTimesheet = this.onClickTimesheet.bind(this);
        this.onClickProgressBar = this.onClickProgressBar.bind(this);
        this.onClickEmployeeTimesheets = this.onClickEmployeeTimesheets.bind(this);
    }

    // --------------------------------------------------------------------------
    // Function to convert data
    // --------------------------------------------------------------------------

    convertToHHMM(timeString) {
        const timeFloat = parseFloat(timeString);
        const hours = Math.floor(timeFloat);
        const minutes = Math.round((timeFloat - hours) * 60);

        const formattedHours = hours.toString().padStart(2, "0");
        const formattedMinutes = minutes.toString().padStart(2, "0");

        return `${formattedHours}:${formattedMinutes}`;
    }

    // --------------------------------------------------------------------------
    // Getters
    // --------------------------------------------------------------------------

    get projectId() {
        return this.props.projectId;
    }

    get employees() {
        return this.props.employeesData;
    }

    get employeesLength() {
        return this.props.employeesData.length;
    }

    get maxWorkTime() {
        const allEmployees = this.props.employeesData;
        return (allEmployees || []).reduce((max, employee) => {
            return employee.total > max ? employee.total : max;
        }, 0);
    }

    // --------------------------------------------------------------------------
    // Action for buttons
    // --------------------------------------------------------------------------

    async onClickTimesheet(filterType) {
        const projectId = this.props.projectId;
        if (projectId && filterType) {
            try {
                const action = await this.orm.call(
                    "project.project",
                    `action_project_timesheets_with_filters`,
                    [projectId, filterType]
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

    async onClickProgressBar(employeeId, invoiceType) {
        const projectId = this.props.projectId;
        if (employeeId && invoiceType && projectId) {
            try {
                const action = await this.orm.call(
                    "project.project",
                    `action_project_timesheets_with_all_filters`,
                    [projectId, employeeId, invoiceType]
                );
                this.action.doAction(action);
            } catch (error) {
                this.notification.add("An error has occurred : onClickProgressBar", {
                    type: "danger",
                });
            }
        }
    }

    async onClickEmployeeTimesheets(employeeId) {
        const projectId = this.props.projectId;
        if (employeeId && projectId) {
            try {
                const action = await this.orm.call(
                    "project.project",
                    `action_employee_timesheets`,
                    [projectId, employeeId]
                );
                this.action.doAction(action);
            } catch (error) {
                this.notification.add(
                    "An error has occurred : onClickEmployeeTimesheets",
                    {
                        type: "danger",
                    }
                );
            }
        }
    }
}

TimeByPeople.template = "project_overview.TimeByPeople";
