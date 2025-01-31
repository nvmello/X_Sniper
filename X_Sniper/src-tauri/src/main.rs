use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use std::thread;
use std::path::PathBuf;

fn spawn_and_log(name: &str, mut child: std::process::Child) {
    if let Some(stdout) = child.stdout.take() {
        let name = name.to_owned();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            reader.lines().for_each(|line| {
                if let Ok(line) = line {
                    println!("[{}] {}", name, line);
                }
            });
        });
    }

    if let Some(stderr) = child.stderr.take() {
        let name = name.to_owned();
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            reader.lines().for_each(|line| {
                if let Ok(line) = line {
                    eprintln!("[{}] {}", name, line);
                }
            });
        });
    }
}

fn get_venv_python(project_root: &PathBuf) -> PathBuf {
    if cfg!(target_os = "windows") {
        project_root.join("backend").join("scraper").join("venv").join("Scripts").join("python.exe")
    } else {
        project_root.join("backend").join("scraper").join("venv").join("bin").join("python")
    }
}

#[tauri::command]
async fn start_services() -> Result<(), String> {
    // Get project root directory
    let project_root = std::env::current_dir()
        .map_err(|e| e.to_string())?
        .parent()
        .ok_or("Cannot find project root")?
        .to_path_buf();

    println!("Project root: {:?}", project_root);
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

    // Start NATS
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

    // Start Python script using venv Python
    println!("Starting Python scraper...");
    let venv_python = get_venv_python(&project_root);
    println!("Using Python from: {:?}", venv_python);
    
    let scraper = Command::new(venv_python)
        .arg("monitor_x.py")
        .env("PYTHONUNBUFFERED", "1")
        .current_dir(&scraper_dir)  // Set working directory to scraper dir
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start Python scraper: {}", e))?;

    spawn_and_log("Python", scraper);

    //Start TypeScript bot
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

    println!("All services started successfully!");
    Ok(())
}

fn main() {
    println!("Starting application...");
    println!("Current directory: {:?}", std::env::current_dir().unwrap());
    
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![start_services])
        .setup(|_app| {
            tauri::async_runtime::spawn(async {
                match start_services().await {
                    Ok(_) => println!("Services started successfully via setup"),
                    Err(e) => eprintln!("Failed to start services: {}", e),
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}