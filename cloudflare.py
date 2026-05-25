import requests
import sys

# --- your credentials (paste as-is for a quick test) ---
API_TOKEN = "cfat_dYVmeXskeSTVzYjzH9swnpTvrvhLfnGqO6LVRwLZ7292a700"
ACCOUNT_ID = "0d0a0a287282172b39fb04d9334d8346"

# Cloudflare Pages – list projects endpoint
# GET https://api.cloudflare.com/client/v4/accounts/{account_id}/pages/projects
base_url = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/pages/projects"

headers = {
    "Authorization": f"Bearer {API_TOKEN}", # required: Pages Read or Pages Write【12349452513496639†L35-L41】
    "Content-Type": "application/json"
}

def list_all_pages():
    page = 1
    per_page = 50
    projects = []

    while True:
        resp = requests.get(base_url, headers=headers, params={"page": page, "per_page": per_page})
        if resp.status_code!= 200:
            print(f"Error {resp.status_code}: {resp.text}", file=sys.stderr)
            break

        data = resp.json()
        if not data.get("success"):
            print("API returned an error:", data.get("errors"), file=sys.stderr)
            break

        for proj in data["result"]:
            # 'name' is the project name field【8789637175294040584†L387-L391】
            projects.append(proj["name"])

        # pagination – stop when we've seen the last page
        result_info = data.get("result_info", {})
        if page >= result_info.get("total_pages", 1):
            break
        page += 1

    return projects

if __name__ == "__main__":
    names = list_all_pages()
    if names:
        print("Cloudflare Pages projects in this account:")
        for n in names:
            print(f"- {n}")
    else:
        print("No projects found or token lacks permission.")