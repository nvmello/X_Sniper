// Import the `commands` and `services` modules.
// These modules contain the logic for handling commands and services in your application.
mod commands;
mod services;
use rusqlite::{Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
struct User {
    username: String,
    // mint: Option<String>,
    // amount: f64,
}

#[tauri::command]
fn get_users() -> Result<Vec<User>, String> {
    
    // Get the current executable's directory (src-tauri)
    let current_dir = std::env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?;
    
    // Navigate up one directory to project root, then to database
    let db_path = current_dir
        .parent()
        .ok_or_else(|| "Failed to get parent directory".to_string())?
        .join("database")
        .join("sniper.db");
    
    println!("Attempting to connect to database at: {:?}", db_path);
    
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;
    
    let mut stmt = conn
        .prepare("SELECT username, mint, amount FROM users")
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;
    
    let users = stmt
        .query_map([], |row| {
            Ok(User {
                username: row.get(0)?,
                // mint: row.get(1)?,
                // amount: row.get(3)?,
            })
        })
        .map_err(|e| format!("Failed to execute query: {}", e))?
        .collect::<Result<Vec<User>, _>>()
        .map_err(|e| format!("Failed to collect results: {}", e))?;

    println!("Found {} users", users.len());
    Ok(users)
}

// Import the `Builder` struct from the `tauri` crate.
// `Builder` is used to configure and build the Tauri application.
use tauri::Builder;

// The `main` function is the entry point of the Rust program.
fn main() {
    // Print a message to indicate that the application is starting.
    println!("Starting application...");

    // Print the current working directory of the application.
    // This is useful for debugging purposes to ensure the application is running in the expected directory.
    println!("Current directory: {:?}", std::env::current_dir().unwrap());

    // Use the Tauri `Builder` to configure and run the application.
    Builder::default()

    // Use the `setup` method to run initialization code before the Tauri application starts.
        // Remove this entire .setup() block
        .setup(|_app| {
            tauri::async_runtime::spawn(async {
                if let Err(e) = commands::services::start_nats().await {
                    eprintln!("Failed to start NATS: {}", e);
                } else {
                    println!("NATS Service started successfully via setup");
                }

                if let Err(e) = commands::services::start_listening_for_users().await {
                    eprintln!("Failed to start listening for users: {}", e);
                } else {
                    println!("Listening for users started successfully");
                }

                if let Err(e) = commands::services::start_sniper().await {
                    eprintln!("Failed to start Sniper: {}", e);
                } else {
                    println!("Sniper Service started successfully via setup");
                }
            });

            Ok(())
        })

        // Set up the invoke handler for Tauri commands.
        // `invoke_handler` allows the frontend (e.g., JavaScript) to call Rust functions.
        // Here, we register the `start_services` function from the `commands::services` module.
        .invoke_handler(tauri::generate_handler![
            get_users,
            commands::services::start_scraper,
            commands::services::send_message,
        ])

        
        // Run the Tauri application.
        // `generate_context!()` is a macro that generates the necessary context for the application to run.
        .run(tauri::generate_context!())
        // If the application fails to run, print an error message and exit.
        .expect("error while running tauri application");
}