use serde::Serialize;
use sysinfo::System;
use std::sync::Mutex;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SystemStats {
    pub cpu_usage: f32,
    pub memory_usage: f32,
    pub memory_used_gb: f32,
    pub memory_total_gb: f32,
}

pub struct SystemMonitor {
    sys: Mutex<System>,
}

impl SystemMonitor {
    pub fn new() -> Self {
        let mut sys = System::new_all();
        sys.refresh_all();
        Self {
            sys: Mutex::new(sys),
        }
    }

    pub fn get_stats(&self) -> SystemStats {
        let mut sys = self.sys.lock().unwrap();
        sys.refresh_cpu_usage();
        sys.refresh_memory();

        let cpu_usage = sys.global_cpu_usage();
        let total_memory = sys.total_memory() as f64;
        let used_memory = sys.used_memory() as f64;
        let gb = 1_073_741_824.0; // 1 GB in bytes

        SystemStats {
            cpu_usage: (cpu_usage * 10.0).round() / 10.0,
            memory_usage: if total_memory > 0.0 {
                ((used_memory / total_memory * 1000.0).round() / 10.0) as f32
            } else {
                0.0
            },
            memory_used_gb: ((used_memory / gb * 10.0).round() / 10.0) as f32,
            memory_total_gb: ((total_memory / gb * 10.0).round() / 10.0) as f32,
        }
    }
}

#[tauri::command]
pub fn get_system_stats(monitor: tauri::State<'_, SystemMonitor>) -> SystemStats {
    monitor.get_stats()
}
