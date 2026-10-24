"""Non-destructive browser regression: run with a minted host session."""
import asyncio
import json
import os
import re
from playwright.async_api import async_playwright, expect


async def main():
    with open(os.path.expanduser("~/.cache/lovable-auth/session.json")) as file:
        session = json.load(file)
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 1800})
        await page.goto("http://localhost:8080")
        await page.evaluate("([k,v]) => localStorage.setItem(k,v)",
                            [session["storage_key"], json.dumps(session["session"])])
        await page.goto("http://localhost:8080/host/wardrobe/manage")
        minimum = page.get_by_placeholder("Price from ₹")
        maximum = page.get_by_placeholder("Price to ₹")
        heading = page.get_by_role("heading", name="In the lookbook", exact=False)
        await minimum.wait_for()
        await expect(heading).to_contain_text(re.compile(r"In the lookbook \([1-9]"))
        original = await heading.inner_text()
        assert int(re.search(r"\((\d+)", original).group(1)) > 0

        async def expect_empty():
            await expect(heading).to_contain_text("In the lookbook (0")
            await page.locator("#select-all-looks").click()
            assert await page.get_by_text(re.compile(r"\d+ selected — apply to all of them:")).count() == 0

        # A lower bound above every outfit must select no records for bulk deletion.
        await minimum.fill("999999999")
        await expect_empty()
        await minimum.fill("")
        await expect(heading).to_have_text(original)

        # An upper bound below every outfit must also recompute immediately.
        await maximum.fill("-1")
        await expect_empty()
        await maximum.fill("")
        await expect(heading).to_have_text(original)

        # Non-empty realistic range: select-all uses the visible price-filtered rows.
        await minimum.fill("30000")
        await maximum.fill("55000")
        await page.wait_for_timeout(300)
        visible = int(re.search(r"\((\d+)", await heading.inner_text()).group(1))
        assert 0 < visible < int(re.search(r"\((\d+)", original).group(1))
        await page.locator("#select-all-looks").click()
        await page.get_by_text(f"{visible} selected — apply to all of them:", exact=True).wait_for()
        os.makedirs("/tmp/browser/wardrobe-price", exist_ok=True)
        await page.screenshot(path="/tmp/browser/wardrobe-price/verified.png")
        print(f"Price bounds update immediately; select-all targets {visible} filtered looks; no outfits deleted.")
        await browser.close()


asyncio.run(main())