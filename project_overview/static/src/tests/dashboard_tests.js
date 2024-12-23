/** @odoo-module **/

import {setupControlPanelServiceRegistry} from "@web/../tests/search/helpers";
import {getFixture, patchDate, patchWithCleanup} from "@web/../tests/helpers/utils";
import {browser} from "@web/core/browser/browser";
import {Dashboard} from "../components/dashboard/dashboard";
const testUtils = require("web.test_utils");
const {QUnit} = window;
const {createComponent} = testUtils;

function getDomain(controlPanel) {
    return controlPanel.env.searchModel.domain;
}

let target = null;
let serverData = null;

QUnit.module("Project", (hooks) => {
    hooks.beforeEach(async () => {
        serverData = {
            models: {
                foo: {
                    fields: {},
                    records: {},
                },
            },
            views: {},
        };
        patchWithCleanup(browser, {
            setTimeout: (fn) => fn(),
            // eslint-disable-next-line no-empty-function
            clearTimeout: () => {},
        });
        target = getFixture();
    });

    QUnit.module("ProjectOverview");

    QUnit.test("currency price formatting", async (assert) => {
        assert.expect(1);

        const props = {};

        const dashboard = await createComponent(Dashboard, {
            props: {
                currency: "EUR",
            },
        });

        const formattedPrice = dashboard.component.formatPriceAsCurrency(1234.56);
        assert.strictEqual(
            formattedPrice,
            "1 234,56 €",
            "Le formatage des prix est correct"
        );
    });
});
