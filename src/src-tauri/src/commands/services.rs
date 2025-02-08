use crate::services::{nats, python, sniper};
use std::sync::Mutex;
use once_cell::sync::Lazy;
use serde_json::Value;
// use std::time::Duration;
use tokio::time::{Duration};


static SNIPER_INIT_STATE: Lazy<Mutex<bool>> = Lazy::new(|| Mutex::new(false));
static SCRAPER_INIT_STATE: Lazy<Mutex<bool>> = Lazy::new(|| Mutex::new(false));
static NATS_INIT_STATE: Lazy<Mutex<bool>> = Lazy::new(|| Mutex::new(false));
static LISTENER_INIT_STATE: Lazy<Mutex<bool>> = Lazy::new(|| Mutex::new(false));

#[tauri::command]
pub async fn start_sniper() -> Result<(), String> {
    println!("Starting sniper service...");
    
    // Check if services are already started
    let mut started = SNIPER_INIT_STATE.lock().map_err(|e| format!("Lock error: {}", e))?;
    if *started {
        println!("Sniper already started!");
        return Ok(());
    }

    // Get project root directory
    let current_dir = std::env::current_dir().map_err(|e| format!("Failed to get current dir: {}", e))?;
    println!("Current directory: {:?}", current_dir);
    
    let project_root = current_dir
        .parent()
        .ok_or("Cannot find project root - no parent directory")?
        .to_path_buf();
    println!("Project root: {:?}", project_root);

    // Start TypeScript sniper
    match sniper::start(&project_root) {
        Ok(_) => println!("Sniper start function completed successfully"),
        Err(e) => {
            println!("Failed to start sniper: {}", e);
            return Err(e);
        }
    }

    println!("\n🔫🔫🔫🔫🔫🔫🔫🔫🔫 Sniper scripts started successfully! 🔫🔫🔫🔫🔫🔫🔫🔫🔫");
    
    // Mark sniper as started
    *started = true;
    
    Ok(())
}

#[tauri::command]
pub async fn start_scraper() -> Result<(), String> {
    // Check if services are already started
    let mut started = SCRAPER_INIT_STATE.lock().unwrap();
    if *started {
        return Ok(());
    }

    // Get project root directory
    let project_root = std::env::current_dir()
        .map_err(|e| e.to_string())?
        .parent()
        .ok_or("Cannot find project root")?
        .to_path_buf();

    // Start Python scraper
    python::start(&project_root)?;

    println!("🔎🔎🔎🔎🔎🔎🔎🔎🔎 Scraper started successfully! 🔎🔎🔎🔎🔎🔎🔎🔎🔎");
    
    // Mark services as started
    *started = true;
    
    Ok(())
}

#[tauri::command]
pub async fn start_listening_for_users() -> Result<(), String> {
    // Check if services are already started
    let mut started = LISTENER_INIT_STATE.lock().unwrap();
    if *started {
        return Ok(());
    }

    // Get project root directory
    let project_root = std::env::current_dir()
        .map_err(|e| e.to_string())?
        .parent()
        .ok_or("Cannot find project root")?
        .to_path_buf();

    // Start Python scraper
    python::start_listening(&project_root)?;

    println!("👂👂👂👂👂👂👂👂 Scraper started successfully! 👂👂👂👂👂👂👂👂");
    
    // Mark services as started
    *started = true;
    
    Ok(())
}

#[tauri::command]
pub async fn start_nats() -> Result<(), String> {
    // Check if nats are already started
    let mut started = NATS_INIT_STATE.lock().unwrap();
    if *started {
        return Ok(());
    }

    // Get project root directory
    let project_root = std::env::current_dir()
        .map_err(|e| e.to_string())?
        .parent()
        .ok_or("Cannot find project root")?
        .to_path_buf();

    // Start Python nats
    nats::start(&project_root)?;

    println!("\n💬💬💬💬💬💬💬💬💬 Nats started successfully! 💬💬💬💬💬💬💬💬💬");
    
    // Mark nats seerver as started
    *started = true;
    
    Ok(())
}

#[tauri::command]
pub async fn send_message(subject: String, payload: Value) -> Result<(), String> {
    let nats_url = "nats://127.0.0.1:4222";
    let client = async_nats::connect(nats_url).await.map_err(|e| e.to_string())?;
    let message = serde_json::to_string(&payload).map_err(|e| e.to_string())?;

    println!("Publishing to subject: {}", subject);
    println!("Message: {}", message);

    client.publish(subject.clone(), message.into()).await.map_err(|e| e.to_string())?;
    client.flush().await.map_err(|e| e.to_string())?;  // 🔥 Ensures the message is actually sent

    tokio::time::sleep(Duration::from_secs(2)).await;  // 🚀 Keep connection open

    println!("\n✅✅✅✅✅ Message published successfully! ✅✅✅✅✅");
    Ok(())
}

