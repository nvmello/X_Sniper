use std::io::{BufRead, BufReader};
use std::process::Child;
use std::thread;
use std::path::PathBuf;

pub fn spawn_and_log(name: &str, mut child: Child) {
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

pub fn get_venv_python(project_root: &PathBuf) -> PathBuf {
    if cfg!(target_os = "windows") {
        project_root.join("backend").join("scraper").join("venv").join("Scripts").join("python.exe")
    } else {
        project_root.join("backend").join("scraper").join("venv").join("bin").join("python")
    }
}