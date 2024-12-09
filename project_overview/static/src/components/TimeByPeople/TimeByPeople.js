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
    async onClickTimesheet(filterType) {
        const projectId = this.props.projectId;
        if (projectId) {
            try {
                const action = await this.orm.call(
                    "project.project",
                    `action_project_timesheets_${filterType}`,
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

    // Action du bouton "Quantité fixe facturable"
    async onClickBillableFixed() {
        await this.onClickTimesheet("billable_fixed");
    }

    // Action du bouton "Temps facturable"
    async onClickBillableTime() {
        await this.onClickTimesheet("billable_time");
    }

    // Action du bouton "Non facturable"
    async onClickNonBillable() {
        await this.onClickTimesheet("non_billable");
    }

    // Action du bouton "Temps manuel facturable"
    async onClickBillableManual() {
        await this.onClickTimesheet("billable_manual");
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
