use std::process::{Command, Stdio};
use std::path::PathBuf;
use crate::commands::utils::spawn_and_log;

pub fn start(project_root: &PathBuf) -> Result<(), String> {
    println!("Starting sniper...");
    let trading_dir = project_root.join("backend").join("sniper");

    let bot = Command::new("npx")
        .arg("tsx")
        .arg("swap.ts")
        .current_dir(&trading_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start sniper: {}", e))?;

    spawn_and_log("Bot", bot);

    Ok(())
}