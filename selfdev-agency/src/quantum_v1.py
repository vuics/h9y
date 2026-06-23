'''
QuantumV1 Agent Archetype
'''
import logging
import json
import os

from dotenv import load_dotenv
from qiskit import transpile
import qiskit.qasm2
import qiskit.qasm3
from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2 as Sampler

# from qiskit import QuantumCircuit
from qiskit.quantum_info import SparsePauliOp
from qiskit.transpiler import generate_preset_pass_manager
from qiskit_ibm_runtime import EstimatorV2 as Estimator
from qiskit_ibm_runtime.fake_provider import FakeAlmadenV2
import numpy as np


from xmpp_agent import XmppAgent

logger = logging.getLogger("QuantumV1")

# Load env vars
load_dotenv()

# IBM_CLOUD_API_KEY = os.getenv("IBM_CLOUD_API_KEY")
# IBM_CLOUD_QISKIT_INSTANCE = os.getenv("IBM_CLOUD_QISKIT_INSTANCE")


class QuantumV1(XmppAgent):
  '''
  QuantumV1 provides quantum computing with IBM Cloud API
  '''
  async def start(self):
    await super().start()
    try:
      self.quantumConfig = self.config.options.quantum
      logger.debug(f'self.quantumConfig: {self.quantumConfig}')

      self.service = QiskitRuntimeService(
        channel='ibm_cloud',
        instance=self.quantumConfig.instance,
        token=self.quantumConfig.apiKey,
      )
      instances = self.service.instances()
      logger.debug(f'Instances: {instances}')
      backends = self.service.backends()
      logger.debug(f'Backends: {backends}')

      if self.quantumConfig.backend == "least_busy":
        self.backend = self.service.least_busy(
          operational=True, simulator=False, min_num_qubits=self.quantumConfig.minNumQubits,
        )
      elif self.quantumConfig.backend == "fake_almaden_v2":
        self.backend = FakeAlmadenV2()
      else:
        self.backend = self.service.backend(self.quantumConfig.backend)
      logger.debug(f'Backend: {self.backend}')
      logger.debug(f'Backend coupling_map: {self.backend.coupling_map}')

      await self.slog('debug', 'Agent started')

    except Exception as e:
      logger.error(f"Error initializing model: {e}")
      await self.slog('error', f"Error initializing model: {e}")

  async def chat(self, *, prompt, reply_func=None):
    try:
      logger.debug(f"prompt: {prompt}")
      logger.debug(f'self.config.options: {self.config.options}')

      logger.debug(f'• Prompt: {prompt}')
      if self.quantumConfig.language == "qasm2":
        circuit = qiskit.qasm2.loads(prompt)
      elif self.quantumConfig.language == "qasm3":
        circuit = qiskit.qasm3.loads(prompt)
      logger.debug(f'Circuit:\n{circuit}')

      content = ""
      if self.quantumConfig.draw.enable:
        drawing = circuit.draw(output=self.quantumConfig.draw.output, style=self.quantumConfig.draw.style)
        drawing = str(drawing)
        logger.debug('• Drawing: {drawing}')
        content += f'\n```qasm\n{drawing}\n```\n\n'

      transpiled_circuit = transpile(circuit, self.backend)
      logger.debug(f'Transpiled circuit:\n{transpiled_circuit}')

      if self.quantumConfig.optimizationLevel == 0:
        sampler = Sampler(self.backend)
        job = sampler.run([transpiled_circuit])
      else:
        pm = generate_preset_pass_manager(
          optimization_level=self.quantumConfig.optimizationLevel,
          backend=self.backend
        )
        isa_circuit = pm.run(transpiled_circuit)
        print(f">>> Circuit ops (ISA): {isa_circuit.count_ops()}")
        sampler = Sampler(mode=self.backend)
        job = sampler.run([(isa_circuit)])

      print(f">>> Job ID: {job.job_id()}")
      print(f">>> Job Status: {job.status()}")
      result = job.result()
      pub_result = result[0]
      logger.debug(f'pub_result: {pub_result}')
      logger.debug(f'pub_result.data: {pub_result.data}')
      logger.debug(f'result[0].data.c.get_counts(): {result[0].data.c.get_counts()}')
      counts = result[0].data.c.get_counts()
      logger.debug(f'counts: {counts}')
      json_counts = json.dumps(counts, indent=2)
      content += f'\n```json\n{json_counts}\n```\n\n'

      # logger.debug(f'• Content: {content}')
      return content
    except Exception as e:
      logger.error(f"Quantum error: {e}")
      await self.slog('error', f"Quantum error: {e}")
      return f'Error: {str(e)}'
