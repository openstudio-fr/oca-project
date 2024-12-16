/** @odoo-module **/

import {Component} from "@odoo/owl";
import {useService} from "@web/core/utils/hooks";

export class TimeByPeople extends Component {
    setup() {
        super.setup();

        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");
    }

    // Permet d'obtenir l'id du projet
    get projectId() {
        return this.props.projectId;
    }

    // Permet d'obtenir les informations sur les employés
    get employees() {
        return this.props.employeesData;
    }

    get employeesLength() {
        return this.props.employeesData.length;
    }

    // Permet d'obtenir le temps maximum qu'un employé à travailler sur le projet
    get maxTotal() {
        const allEmployees = this.props.employeesData;
        return (allEmployees || []).reduce((max, employee) => {
            return employee.total > max ? employee.total : max;
        }, 0);
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

    // Fonction générique pour les boutons d'actions qui ouvre une feuille de temps avec un filtre spécifique
    onClickTimesheet = async (filterType) => {
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

    // Action au clic de la barre de progression
    onClickProgressBar = async (employeeId,invoiceType) => {
        const projectId = this.props.projectId;
        if(employeeId && invoiceType && projectId){
            try {
                const action = await this.orm.call(
                    "project.project",
                    `action_project_timesheets_with_all_filters`,
                    [projectId, employeeId, invoiceType]
                );
                this.action.doAction(action);
            } catch (error) {
                this.notification.add("Une erreur est survenue : onClickProgressBar", {
                    type: "danger",
                });
            }
        }
    }

    // Action qui ouvre la feuille de temps d'un employé
    openEmployeeTimesheets = async (employeeId) => {
        const projectId = this.props.projectId;
        try {
            const action = await this.orm.call(
                "project.project",
                `action_employee_timesheets`,
                [projectId, employeeId]
            );
            this.action.doAction(action);
        } catch (error) {
            this.notification.add("Une erreur est survenue : openEmployeeTimesheets", {
                type: "danger",
            });
        }
    };
}

TimeByPeople.template = "project_overview.TimeByPeople";
