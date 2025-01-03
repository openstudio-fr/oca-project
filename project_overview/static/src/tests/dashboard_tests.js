/** @odoo-module **/

import {getFixture, mount, patchWithCleanup} from "@web/../tests/helpers/utils";
import {actionService} from "@web/webclient/actions/action_service";
import {browser} from "@web/core/browser/browser";
import {Dashboard} from "../components/dashboard/dashboard";
import {hotkeyService} from "@web/core/hotkeys/hotkey_service";
import {makeTestEnv} from "@web/../tests/helpers/mock_env";
import {menuService} from "@web/webclient/menus/menu_service";
import {notificationService} from "@web/core/notifications/notification_service";
import {ormService} from "@web/core/orm_service";
import {registry} from "@web/core/registry";
import {uiService} from "@web/core/ui/ui_service";
import {viewService} from "@web/views/view_service";

const serviceRegistry = registry.category("services");
const {QUnit} = window;

let baseConfig = null;
let target = null;

QUnit.module("project_overview.Dashboard", {
    async beforeEach() {
        target = getFixture();
        serviceRegistry.add("menu", menuService);
        serviceRegistry.add("action", actionService);
        serviceRegistry.add("notification", notificationService);
        serviceRegistry.add("hotkey", hotkeyService);
        serviceRegistry.add("ui", uiService);
        serviceRegistry.add("view", viewService);
        serviceRegistry.add("orm", ormService);

        patchWithCleanup(browser, {
            setTimeout: (handler, ...args) => handler(...args),
            // eslint-disable-next-line no-empty-function
            clearTimeout: () => {},
        });

        const menus = {
            root: {id: "root", children: [1], name: "root", appID: "root"},
            1: {id: 1, children: [], name: "App0", appID: 1},
        };

        const serverData = {menus};
        baseConfig = {serverData};
    },
});

QUnit.test("Should render Dashboard component", async (assert) => {
    assert.expect(8);

    const env = await makeTestEnv(baseConfig);

    const mockProps = {
        profitabilityData: {
            revenues: {
                data: [],
                total: {invoiced: 1000, to_invoice: 500},
            },
            costs: {
                data: [],
                total: {billed: -300, to_bill: -200},
            },
        },
        invoiceTypeData: [
            {timesheet_invoice_type: "billable_time", unit_amount: 5},
            {timesheet_invoice_type: "non_billable", unit_amount: 2},
        ],
        projectId: 1,
        currency: "EUR",
    };

    await mount(Dashboard, target, {env, props: mockProps});

    const dashboardInstance = target.querySelector(".o_dashboard");
    assert.ok(dashboardInstance, "Dashboard component should be rendered");

    const pageTextContent = target.textContent;

    assert.ok(
        pageTextContent.includes("300,00 €"),
        "The total cost billed should be present in the page"
    );

    assert.ok(
        pageTextContent.includes("500,00 €"),
        "The income to be billed must be present in the page"
    );
    const totalProfitability = new Dashboard(mockProps).totalProfitability;
    assert.strictEqual(
        totalProfitability,
        1000,
        "Profitability total should be correctly calculated"
    );

    const formattedPrice = new Dashboard(mockProps).formatPriceAsCurrency(1234.56);
    assert.strictEqual(
        formattedPrice,
        "1 234,56 €",
        "Price should be formatted as currency according to locale and currency code"
    );

    const formattedZeroPrice = new Dashboard(mockProps).formatPriceAsCurrency(0);
    assert.strictEqual(
        formattedZeroPrice,
        "0,00 €",
        "Price of 0 should be formatted correctly"
    );

    const formattedNegativePrice = new Dashboard(mockProps).formatPriceAsCurrency(
        -456.78
    );
    assert.strictEqual(
        formattedNegativePrice,
        "-456,78 €",
        "Negative prices should be formatted correctly"
    );

    const convertToHHMM = new Dashboard(mockProps).convertToHHMM(666.25);
    assert.strictEqual(convertToHHMM, "666:15", "convert to HHMM should be correct");
});
