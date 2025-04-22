import { getNode } from '@/react/docker/proxy/queries/nodes/useNode';
import { getNodes } from '@/react/docker/proxy/queries/nodes/useNodes';
import { updateNode } from '@/react/docker/proxy/queries/nodes/useUpdateNodeMutation';

import { NodeViewModel } from '../models/node';

angular.module('portainer.docker').factory('NodeService', NodeServiceFactory);

/* @ngInject */
function NodeServiceFactory(AngularToReact, $http) { // Inject $http
  const { useAxios, injectEnvironmentId } = AngularToReact;

  return {
    nodes: useAxios(injectEnvironmentId(nodesAngularJS)), // macvlan form + services list + service create + service edit + swarm visualizer + stack edit
    node: useAxios(injectEnvironmentId(nodeAngularJS)), // node browser + node details
    updateNode: useAxios(injectEnvironmentId(updateNodeAngularJS)), // swarm node details panel
    addNode: useAxios(injectEnvironmentId(addNodeAngularJS)), // add new swarm node
    addNodeRedirect: () => {
      // 跳转到新增节点表单页面的逻辑
      window.location.href = `#/docker/swarm/nodes/add`;
    }
  };

  /**
   * @param {EnvironmentId} environmentId
   * @param {NodeId} id
   */
  async function nodeAngularJS(environmentId, id) {
    const data = await getNode(environmentId, id);
    return new NodeViewModel(data);
  }

  /**
   * @param {EnvironmentId} environmentId
   */
  async function nodesAngularJS(environmentId) {
    const data = await getNodes(environmentId);
    return data.map((n) => new NodeViewModel(n));
  }

  /**
   * @param {EnvironmentId} environmentId
   * @param {NodeSpec & { Id: string; Version: number }} nodeConfig
   */
  async function updateNodeAngularJS(environmentId, nodeConfig) {
    return updateNode(environmentId, nodeConfig.Id, nodeConfig, nodeConfig.Version);
  }

  /**
   * @param {EnvironmentId} environmentId
   * @param {Object} nodeData - { node_ip, node_user, node_password, node_port, node_role }
   */
  async function addNodeAngularJS(environmentId, nodeData) {
    try {
      const response = await $http.post(`/api/docker/${environmentId}/nodes/add`, nodeData, {
        timeout: 300000 // 5 minutes timeout
      });
      return response.data;
    } catch (error) {
      // Rethrow or handle error appropriately
      console.error('Error adding node:', error);
      throw error;
    }
  }
}
