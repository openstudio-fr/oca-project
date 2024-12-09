/** @odoo-module **/

import {registry} from "@web/core/registry";
import {ProjectOverviewComponent} from "../components/ProjectOverview/ProjectOverview";
import {formView} from "@web/views/form/form_view";
import {CustomFormController} from "./custom_form/custom_form_controller";
import {CustomFormRenderer} from "./custom_form/custom_form_renderer";
import {ProjectControlPanel} from "./custom_form/custom_form_panel";

registry.category("fields").add("project_overview", ProjectOverviewComponent);

registry
    .category("views")
    .add("ProjectOverview.ProjectOverviewComponent", ProjectOverviewComponent);

export const customFormView = {
    ...formView,
    withSearchBar: true,
    searchMenuTypes: ["filter", "favorite"],
    // Renderer: CustomFormRenderer,
    // Controller: CustomFormController,
    // ControlPanel: ProjectControlPanel,
};

registry.category("views").add("custom_form_view", customFormView);

// var ProjectOverview = qweb.View.extend({
//     withSearchBar: true,
//     searchMenuTypes: [],
// });
// viewRegistry.add('project_overview_qweb', ProjectOverview);
