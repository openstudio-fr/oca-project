/** @odoo-module **/
import {Component} from "@odoo/owl";

export class Timesheets extends Component {
    employees = [
        {
            name: "FOULHOUX Damien",
            before: "112:00",
            sept: "00:00",
            oct: "00:00",
            nov: "00:00",
            done: "112:00",
            sold: "00:00",
            remaining: "00:00",
        },
        {
            name: "Rhein Quentin",
            before: "24:15",
            sept: "00:00",
            oct: "00:00",
            nov: "00:00",
            done: "24:15",
            sold: "00:00",
            remaining: "00:00",
        },
    ];
}

Timesheets.template = "project_overview.Timesheets";
