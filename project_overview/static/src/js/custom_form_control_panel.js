/** @odoo-module */

import {ControlPanel} from "@web/search/control_panel/control_panel";

export class CustomFormControlPanel extends ControlPanel {
    async setup() {
        super.setup();
        const searchItems = this.env.searchModel.searchItems;
        const searchViewFields = this.env.searchModel.searchViewFields;

        if (searchItems) {
            const tempSearchItems = {...searchItems};
            const filtersToKeep = ["start_date", "end_date"];
            // sale_order_id
            for (const key in tempSearchItems) {
                if (
                    tempSearchItems[key] &&
                    tempSearchItems[key].name &&
                    !filtersToKeep.includes(tempSearchItems[key].name)
                ) {
                    delete tempSearchItems[key];
                }
            }

            // console.log(tempSearchItems);
            this.env.searchModel.searchItems = [];
            // this.env.searchModel.searchItems = tempSearchItems;
        }

        if (searchViewFields) {
            const tempSearchViewFields = {...searchViewFields};
            const searchFiltersToKeep = ["date", "date_start", "sale_order_id"];

            for (const key in tempSearchViewFields) {
                if (
                    tempSearchViewFields[key] &&
                    tempSearchViewFields[key].name &&
                    !searchFiltersToKeep.includes(tempSearchViewFields[key].name)
                ) {
                    delete tempSearchViewFields[key];
                }
            }
            // console.log(searchViewFields, tempSearchViewFields)
            this.env.searchModel.searchViewFields = tempSearchViewFields;
        }
    }
}
