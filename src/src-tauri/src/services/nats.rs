use std::process::{Command, Stdio};
use std::path::PathBuf;
use crate::commands::utils::spawn_and_log;

pub fn start(_project_root: &PathBuf) -> Result<(), String> {
    println!("Starting NATS server...");
    let nats = Command::new("nats-server")
        .arg("--port")
        .arg("4222")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start NATS: {}", e))?;

    spawn_and_log("NATS", nats);
    std::thread::sleep(std::time::Duration::from_secs(2));

    Ok(())
}