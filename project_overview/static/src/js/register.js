/** @odoo-module **/

import {formView} from "@web/views/form/form_view";
import {registry} from "@web/core/registry";
import {CustomFormControlPanel} from "./custom_form_control_panel";
import {CustomFormController} from "./custom_form_controller";
import {ProjectOverviewComponent} from "../components/project_overview/project_overview";
import {Timesheets} from "../components/timesheets/timesheets";

export const projectOverviewFormView = {
    ...formView,
    ControlPanel: CustomFormControlPanel,
    Controller: CustomFormController,
    searchMenuTypes: ["filter", "favorite"],
    buttonTemplate: "project.CustomFormView.Buttons",
};

registry.category("fields").add("project_overview", ProjectOverviewComponent);
registry.category("fields").add("project_timesheets", Timesheets);
registry.category("views").add("project_overview_form_view", projectOverviewFormView);
registry
    .category("views")
    .add("ProjectOverview.ProjectOverviewComponent", ProjectOverviewComponent);
