from playwright.sync_api import sync_playwright

def inspect_tabs():
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
        for context in browser.contexts:
            for page in context.pages:
                url = page.url
                if "01a0d565" in url or "01a0d55d" in url:
                    print("====================================")
                    print("PAGE:", url)
                    try:
                        content = page.evaluate("() => document.body.innerText")
                        print("TAIL 1200 chars:\n", content[-1200:])
                    except Exception as e:
                        print("ERR:", e)

if __name__ == "__main__":
    inspect_tabs()
