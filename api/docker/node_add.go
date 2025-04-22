package docker

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os"
	"time"
)

func NodeAdd(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	type nodeAddRequest struct {
		NodeIP       string `json:"node_ip"`
		NodeUser     string `json:"node_user"`
		NodePassword string `json:"node_password"` 
		NodePort     int    `json:"node_port"`
		NodeRole     string `json:"node_role"`
		StackName    string `json:"stack_name"`
	}

	var req nodeAddRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	println(req.NodeIP, req.NodeUser, req.NodePassword, req.NodePort, req.NodeRole, req.StackName)

	swarmMasterIP := os.Getenv("SWARM_MASTER_IP")
	if swarmMasterIP == "" {
		http.Error(w, "SWARM_MASTER_IP environment variable not set", http.StatusInternalServerError)
		return
	}

	port := os.Getenv("KETA_INSTALLER_PORT")
	if port == "" {
		port = "8990" // default port
	}

	client := &http.Client{Timeout: 300 * time.Second}
	requestBody, err := json.Marshal(req)
	println(string(requestBody))
	if err != nil {
		http.Error(w, "Failed to encode request", http.StatusInternalServerError)
		return
	}

	resp, err := client.Post(
		"http://"+swarmMasterIP+":"+port+"/add-node",
		"application/json", 
		bytes.NewBuffer(requestBody),
	)
	if err != nil {
		http.Error(w, "Failed to call swarm master API", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		http.Error(w, "Swarm master API returned error", resp.StatusCode)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]string{
		"status":  "success",
		"message": "Node added to swarm successfully",
	}); err != nil {
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
	}
	
}
