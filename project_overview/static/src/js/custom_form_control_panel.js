/** @odoo-module */

import {ControlPanel} from "@web/search/control_panel/control_panel";

export class CustomFormControlPanel extends ControlPanel {
    async setup() {
        super.setup();
        const searchViewFields = this.env.searchModel.searchViewFields;
        const searchItems = this.env.searchModel.searchItems;
        if (searchItems) {
            const tempSearchItems = {...searchItems};
            const filtersToKeep = ["favorite"];
            for (const key in tempSearchItems) {
                if (
                    tempSearchItems[key] &&
                    tempSearchItems[key].name &&
                    !filtersToKeep.includes(tempSearchItems[key].type)
                ) {
                    delete tempSearchItems[key];
                }
                if (
                    tempSearchItems[key] &&
                    !tempSearchItems[key].name &&
                    tempSearchItems[key].fieldName
                ) {
                    delete tempSearchItems[key];
                }
            }

            this.env.searchModel.searchItems = tempSearchItems;
        }

        if (searchViewFields) {
            const tempSearchViewFields = {...searchViewFields};
            const searchFiltersToKeep = ["date_start", "date", "sale_order_id"];

            for (const key in tempSearchViewFields) {
                if (
                    tempSearchViewFields[key] &&
                    tempSearchViewFields[key].name &&
                    !searchFiltersToKeep.includes(tempSearchViewFields[key].name)
                ) {
                    delete tempSearchViewFields[key];
                }
            }
            this.env.searchModel.searchViewFields = tempSearchViewFields;
        }

        if (this.pagerProps) {
            this.pagerProps = null;
        }
    }
}
