import time
import requests
import os
from dotenv import load_dotenv

# Load the .env file from the current directory
load_dotenv()

# Safely fetch the variables
URL = os.getenv("URL")
TOKEN = os.getenv("TOKEN")
DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL")

HEADERS = {
    "Content-Type": "application/json",
    "X-Shopify-Storefront-Access-Token": TOKEN,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}

# The database query to fetch all products and their live inventory availability flag
GRAPHQL_QUERY = """
{
  products(first: 10) {
    edges {
      node {
        title
        handle
        variants(first: 1) {
          edges {
            node {
              availableForSale
            }
          }
        }
      }
    }
  }
}
"""

def send_discord_message(text_content):
    """Sends a message directly to your Discord channel via Webhook."""
    payload = {"content": text_content}
    try:
        requests.post(DISCORD_WEBHOOK_URL, json=payload, timeout=10)
    except Exception as e:
        print(f"❌ Failed to send Discord notification. Error: {e}")

def fetch_inventory():
    """Queries the backend Shopify database directly for all inventory statuses."""
    try:
        response = requests.post(URL, json={"query": GRAPHQL_QUERY}, headers=HEADERS, timeout=15)
        if response.status_code != 200:
            print(f"⚠️ API Error: Received Status Code {response.status_code}")
            return None
        
        data = response.json()
        return data.get("data", {}).get("products", {}).get("edges", [])
    except Exception as e:
        print(f"❌ Database connection error: {e}")
        return None

def run_diagnostic():
    """Runs at startup to show you the exact live database flags for every item."""
    print("\n🔍 Running Startup Database Diagnostic Sweep...")
    products = fetch_inventory()
    
    if not products:
        print("⚠️ Could not retrieve database items. Check token or network connection.")
        print("--------------------------------------------------\n")
        return

    for edge in products:
        node = edge.get("node", {})
        title = node.get("title")
        variants = node.get("variants", {}).get("edges", [])
        
        if variants:
            is_available = variants[0].get("node", {}).get("availableForSale", False)
            status_text = "✅ IN STOCK" if is_available else "❌ OUT OF STOCK"
            print(f"  {status_text.ljust(15)} : {title}")
        else:
            print(f"  ❓ UNKNOWN STATUS : {title}")
            
    print("--------------------------------------------------\n")

def check_classic_stock():
    print(f"[{time.strftime('%H:%M:%S')}] Pinging Shopify Database for The Classic...")
    products = fetch_inventory()
    
    if not products:
        return False

    for edge in products:
        node = edge.get("node", {})
        # Target the classic specifically using its unique database handle
        if node.get("handle") == "the-classic-100-coconut-water-12pk":
            variants = node.get("variants", {}).get("edges", [])
            if variants:
                is_available = variants[0].get("node", {}).get("availableForSale", False)
                
                if is_available:
                    print("🎉 SUCCESS: The Classic database flag flipped to TRUE!")
                    return True
                else:
                    print("❌ Classic is still out of stock in the database.")
                    return False
                    
    print("⚠️ Warning: Could not find The Classic handle in the database response.")
    return False

# --- MAIN EXECUTION ---
if __name__ == "__main__":
    print("🚀 Initializing Live Shopify Database Monitor...")
    
    # Run the startup check to visually inspect true/false database flags
    run_diagnostic()
    
    # Send a clear verification alert to Discord
    test_ping = "🥥 **Sun Days Monitor:** API Connection Successful! Direct database monitor initialized for 'The Classic'."
    send_discord_message(test_ping)
    
    print("🕒 Entering hourly backend loop. Keep this terminal window open...")
    while True:
        item_found = check_classic_stock()
        
        if item_found:
            alert_text = "🚨 **THE CLASSIC IS BACK IN STOCK!** 🥥\n👉 Buy it right now: https://sundayscoco.com/products"
            send_discord_message(alert_text)
            print("Target acquired. Stopping script.")
            break
            
        # Delay for 1 hour before checking the database again
        time.sleep(3600)