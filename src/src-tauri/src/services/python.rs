use std::process::{Command, Stdio};
use std::path::PathBuf;
use crate::commands::utils::{spawn_and_log, get_venv_python};

pub fn start(project_root: &PathBuf) -> Result<(), String> {
    println!("Starting Python scraper...");
    let scraper_dir = project_root.join("backend").join("scraper");

    // Create and set up virtual environment if it doesn't exist
    if !scraper_dir.join("venv").exists() {
        println!("Setting up Python virtual environment...");
        Command::new("python3")
            .args(&["-m", "venv", "venv"])
            .current_dir(&scraper_dir)
            .output()
            .map_err(|e| format!("Failed to create venv: {}", e))?;

        // Install requirements in the virtual environment
        let venv_pip = get_venv_python(&project_root)
            .parent()
            .unwrap()
            .join(if cfg!(target_os = "windows") { "pip.exe" } else { "pip" });

        Command::new(venv_pip)
            .args(&["install", "-r", "requirements.txt"])
            .current_dir(&scraper_dir)
            .output()
            .map_err(|e| format!("Failed to install requirements: {}", e))?;
    }

    // Start Python script using venv Python
    let venv_python = get_venv_python(&project_root);
    println!("Using Python from: {:?}", venv_python);

    let scraper = Command::new(venv_python)
        .arg("monitor_x.py")
        .env("PYTHONUNBUFFERED", "1")
        .current_dir(&scraper_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start Python scraper: {}", e))?;

    spawn_and_log("Python", scraper);

    Ok(())
}

pub fn start_listening(project_root: &PathBuf) -> Result<(), String> {
    println!("Starting Python scraper...");
    let scraper_dir = project_root.join("backend").join("scraper");

    // Create and set up virtual environment if it doesn't exist
    if !scraper_dir.join("venv").exists() {
        println!("Setting up Python virtual environment...");
        Command::new("python3")
            .args(&["-m", "venv", "venv"])
            .current_dir(&scraper_dir)
            .output()
            .map_err(|e| format!("Failed to create venv: {}", e))?;

        // Install requirements in the virtual environment
        let venv_pip = get_venv_python(&project_root)
            .parent()
            .unwrap()
            .join(if cfg!(target_os = "windows") { "pip.exe" } else { "pip" });

        Command::new(venv_pip)
            .args(&["install", "-r", "requirements.txt"])
            .current_dir(&scraper_dir)
            .output()
            .map_err(|e| format!("Failed to install requirements: {}", e))?;
    }

    // Start Python script using venv Python
    let venv_python = get_venv_python(&project_root);
    println!("Using Python from: {:?}", venv_python);

    let scraper = Command::new(venv_python)
        .arg("inject_user.py")
        .env("PYTHONUNBUFFERED", "1")
        .current_dir(&scraper_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start Python scraper: {}", e))?;

    spawn_and_log("Python", scraper);

    Ok(())
}
