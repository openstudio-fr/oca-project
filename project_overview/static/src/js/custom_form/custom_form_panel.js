/** @odoo-module */

import {ControlPanel} from "@web/search/control_panel/control_panel";
import {useService} from "@web/core/utils/hooks";

export class ProjectControlPanel extends ControlPanel {
    setup() {
        super.setup();
        this.orm = useService("orm");
        this.user = useService("user");
        //  console.log(this.env.searchModel.globalContext)
    }
}

// ProjectControlPanel.template = "project.ProjectControlPanel";
