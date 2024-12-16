/** @odoo-module **/

import {registry} from "@web/core/registry";
import {ProjectOverviewComponent} from "../components/ProjectOverview/ProjectOverview";
import {formView} from "@web/views/form/form_view";
import { Timesheets } from "../components/Timesheets/Timesheets";
import { CustomFormController } from "./custom_form_controller";
import { CustomFormControlPanel } from "./custom_form_control_panel";

export const projectOverviewFormView = {
    ...formView,
    ControlPanel: CustomFormControlPanel,
    Controller: CustomFormController,
    searchMenuTypes: ['filter', 'favorite'],
    buttonTemplate: "project.CustomFormView.Buttons",
};

// console.log(formView)
registry.category("fields").add("project_overview", ProjectOverviewComponent);
registry.category("fields").add("project_timesheets", Timesheets);
registry.category("views").add("project_overview_form_view", projectOverviewFormView);
registry
    .category("views")
    .add("ProjectOverview.ProjectOverviewComponent", ProjectOverviewComponent);
