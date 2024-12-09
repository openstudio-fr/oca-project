/** @odoo-module */

import {FormController} from "@web/views/form/form_controller";

export class CustomFormController extends FormController {
    async setup() {
        super.setup();
        // console.log('CustomFormController')
    }
}

CustomFormController.template = "project_overview.CustomFormView";
