angular.module('portainer.docker').controller('SwarmController', [
  '$q',
  '$scope',
  '$uibModal',
  '$timeout',
  'SystemService',
  'NodeService',
  'Notifications',
  'StateManager',
  'Authentication',
  function ($q, $scope, $uibModal, $timeout, SystemService, NodeService, Notifications, StateManager, Authentication) {
    $scope.info = {};
    $scope.docker = {};
    $scope.swarm = {};
    $scope.totalCPU = 0;
    $scope.totalMemory = 0;

    function extractSwarmInfo(info) {
      // Swarm info is available in SystemStatus object
      var systemStatus = info.SystemStatus;
      // Swarm strategy
      $scope.swarm[systemStatus[1][0]] = systemStatus[1][1];
      // Swarm filters
      $scope.swarm[systemStatus[2][0]] = systemStatus[2][1];
      // Swarm node count
      var nodes = systemStatus[0][1] === 'primary' ? systemStatus[3][1] : systemStatus[4][1];
      var node_count = parseInt(nodes, 10);
      $scope.swarm[systemStatus[3][0]] = node_count;

      $scope.swarm.Status = [];
      extractNodesInfo(systemStatus, node_count);
    }

    function extractNodesInfo(info, node_count) {
      // First information for node1 available at element #4 of SystemStatus if connected to a primary
      // If connected to a replica, information for node1 is available at element #5
      // The next 10 elements are information related to the node
      var node_offset = info[0][1] === 'primary' ? 4 : 5;
      for (let i = 0; i < node_count; i++) {
        extractNodeInfo(info, node_offset);
        node_offset += 9;
      }
    }

    function extractNodeInfo(info, offset) {
      var node = {};
      node.name = info[offset][0];
      node.ip = info[offset][1];
      node.Id = info[offset + 1][1];
      node.status = info[offset + 2][1];
      node.containers = info[offset + 3][1];
      node.cpu = info[offset + 4][1].split('/')[1];
      node.memory = info[offset + 5][1].split('/')[1];
      node.labels = info[offset + 6][1];
      node.version = info[offset + 8][1];
      $scope.swarm.Status.push(node);
    }

    function processTotalCPUAndMemory(nodes) {
      var CPU = 0,
        memory = 0;
      angular.forEach(nodes, function (node) {
        CPU += node.CPUs;
        memory += node.Memory;
      });
      $scope.totalCPU = CPU / 1000000000;
      $scope.totalMemory = memory;
    }

    $scope.getNodes = getNodes;
    function getNodes() {
      var provider = $scope.applicationState.endpoint.mode.provider;
      if (provider === 'DOCKER_SWARM_MODE') {
        NodeService.nodes()
          .then(function (data) {
            var nodes = data;
            processTotalCPUAndMemory(nodes);
            $scope.nodes = nodes;
          })
          .catch(function error(err) {
            Notifications.error('Failure', err, 'Unable to retrieve cluster details');
          });
      }
    }

    function initView() {
      $scope.isAdmin = Authentication.isAdmin();

      var provider = $scope.applicationState.endpoint.mode.provider;
      $q.all({
        version: SystemService.version(),
        info: SystemService.info(),
      })
        .then(function success(data) {
          $scope.docker = data.version;
          $scope.info = data.info;
          if (provider === 'DOCKER_SWARM_MODE') {
            getNodes();
          } else {
            extractSwarmInfo(data.info);
          }
        })
        .catch(function error(err) {
          Notifications.error('Failure', err, 'Unable to retrieve cluster details');
        });
    }

    initView();

    $scope.showAddButton = $scope.isAdmin && $scope.applicationState.endpoint.mode.provider === 'DOCKER_SWARM_MODE';
    // $scope.showAddButton = true;

    $scope.addNode = function() {
      var modalInstance = $uibModal.open({
        templateUrl: '../../components/swarm-node-add-form/swarm-node-add-form.html',
        controller: ['$scope', '$uibModalInstance', '$timeout', 'NodeService', 'Notifications', function($scope, $uibModalInstance, $timeout, NodeService, Notifications) {
          $scope.node = {
            node_ip: '',
            node_user: 'root',
            node_password: '',
            node_port: 22,
            node_role: 'worker',
            stack_name: 'default'
          };
          $scope.formValues = {
            NodeRole: 'worker'
          };
          $scope.loading = false;
          $scope.add = function() {
            $scope.loading = true;
            Notifications.success('Adding node', 'This operation may take several minutes, please wait...');
            
            var payload = {
              node_ip: $scope.node.node_ip,
              node_user: $scope.node.node_user,
              node_password: $scope.node.node_password,
              node_port: $scope.node.node_port,
              node_role: $scope.formValues.NodeRole,
              stack_name: $scope.node.stack_name
            };
            
            // Set timeout to 300 seconds (5 minutes)
            var timeoutPromise = $timeout(function() {
              Notifications.error('Timeout', 'Node addition timed out after 5 minutes');
              $scope.loading = false;
            }, 300000);

            NodeService.addNode(payload)
              .then(function success() {
                $timeout.cancel(timeoutPromise);
                Notifications.success('Node successfully added');
                $uibModalInstance.close();
                $scope.loading = false;
                getNodes();
              })
              .catch(function error(err) {
                $timeout.cancel(timeoutPromise);
                Notifications.error('Failure', err, 'Unable to add node');
                $scope.loading = false;
              });
          };
          $scope.cancel = function() {
            $uibModalInstance.dismiss('cancel');
          };
        }]
      });
    };
  },
]);
