/** @odoo-module **/

import {getFixture, mount, patchWithCleanup} from "@web/../tests/helpers/utils";
import {actionService} from "@web/webclient/actions/action_service";
import {browser} from "@web/core/browser/browser";
import {GlobalActions} from "../components/global_actions/global_actions";
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

QUnit.module("project_overview.GlobalActions", {
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

QUnit.test("Should render Global Actions component", async (assert) => {
    assert.expect(5);

    const env = await makeTestEnv(baseConfig);

    const mockProps = {
        projectId: "1",
        taskCount: "10",
        saleOrderCount: "2",
        invoiceIds: ["17", "4"],
    };

    await mount(GlobalActions, target, {env, props: mockProps});

    const globalActionsInstance = target.querySelector(".o_global_actions");
    assert.ok(globalActionsInstance, "Global Actions component should be rendered");

    const invoiceCount = new GlobalActions(mockProps).invoiceCount;
    assert.strictEqual(
        invoiceCount,
        2,
        "invoiceCount total should be correctly calculated"
    );

    const buttons = target.querySelectorAll(".o_button");
    assert.strictEqual(
        buttons.length,
        5,
        "There should be 5 buttons in the Global Actions component"
    );

    const pageTextContent = target.textContent;
    assert.ok(
        pageTextContent.includes("10 Tasks"),
        "Tasks button should be present in the page"
    );
    assert.ok(
        pageTextContent.includes("2 Sales Orders"),
        "Sales Orders button should be present in the page"
    );
});
