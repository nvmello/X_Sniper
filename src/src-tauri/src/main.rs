// Import the `commands` and `services` modules.
// These modules contain the logic for handling commands and services in your application.
mod commands;
mod services;

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
            });

            Ok(())
        })

        // Set up the invoke handler for Tauri commands.
        // `invoke_handler` allows the frontend (e.g., JavaScript) to call Rust functions.
        // Here, we register the `start_services` function from the `commands::services` module.
        .invoke_handler(tauri::generate_handler![
            commands::services::start_sniper,
            commands::services::start_scraper,
            commands::services::send_message,
        ])

        
        // Run the Tauri application.
        // `generate_context!()` is a macro that generates the necessary context for the application to run.
        .run(tauri::generate_context!())
        // If the application fails to run, print an error message and exit.
        .expect("error while running tauri application");
}