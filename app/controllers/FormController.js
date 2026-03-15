import db from "../database/index.js";
import { randomUUID } from "crypto";

export default {
  async getAllForms(req, res) {
    try {
      const userId = req.user.user_id;
      
      // Buscar apenas formulários do usuário logado
      const forms = await db("forms")
        .where({ user_id: userId })
        .select("id_form", "name", "description", "type", "created_at", "updated_at")
        .orderBy("updated_at", "desc");

      return res.status(200).json(forms);
    } catch (error) {
      console.error("Erro ao buscar formulários:", error);
      return res.status(500).json({
        error: "Erro ao buscar formulários.",
        details: error.message,
      });
    }
  },

  async getFormById(req, res) {
    try {
      const userId = req.user.user_id;
      const { id_form } = req.params;

      // Buscar o form do usuário logado
      const form = await db("forms")
        .where({ id_form, user_id: userId })
        .first();

      if (!form) {
        return res.status(404).json({
          error: "Formulário não encontrado.",
        });
      }

      // Parsear estrutura JSON
      let formStructure = { questions: [] };
      if (form.form_structure) {
        try {
          formStructure = typeof form.form_structure === 'string' 
            ? JSON.parse(form.form_structure) 
            : form.form_structure;
        } catch (e) {
          console.error("Erro ao parsear form_structure:", e);
        }
      }

      return res.status(200).json({
        id_form: form.id_form,
        name: form.name,
        description: form.description,
        type: form.type,
        created_at: form.created_at,
        updated_at: form.updated_at,
        questions: formStructure.questions || [],
      });
    } catch (error) {
      console.error("Erro ao buscar formulário:", error);
      return res.status(500).json({
        error: "Erro ao buscar formulário.",
        details: error.message,
      });
    }
  },

  async submitFormResponse(req, res) {
    try {
      const userId = req.user.user_id;
      const { patient_id, id_form, answers } = req.body;

      // Validações
      if (!patient_id || !id_form) {
        return res.status(400).json({
          error: "Os campos 'patient_id' e 'id_form' são obrigatórios.",
        });
      }

      if (!answers || !Array.isArray(answers) || answers.length === 0) {
        return res.status(400).json({
          error: "É necessário fornecer pelo menos uma resposta no array 'answers'.",
        });
      }

      // Verificar se o paciente existe e pertence ao usuário
      const patient = await db("patients")
        .where({ id: patient_id, user_id: userId })
        .first();

      if (!patient) {
        return res.status(404).json({
          error: "Paciente não encontrado ou sem permissão.",
        });
      }

      // Verificar se o form existe e pertence ao usuário
      const form = await db("forms")
        .where({ id_form, user_id: userId })
        .first();

      if (!form) {
        return res.status(404).json({
          error: "Formulário não encontrado.",
        });
      }

      // Parsear estrutura JSON do formulário
      let formStructure = { questions: [] };
      if (form.form_structure) {
        try {
          formStructure = typeof form.form_structure === 'string' 
            ? JSON.parse(form.form_structure) 
            : form.form_structure;
        } catch (e) {
          console.error("Erro ao parsear form_structure:", e);
          return res.status(400).json({
            error: "Estrutura do formulário inválida.",
          });
        }
      }

      // Validar questões
      const questionIds = (formStructure.questions || []).map((q) => q.id);
      const requiredQuestions = (formStructure.questions || [])
        .filter((q) => q.required)
        .map((q) => q.id);

      // Validar que todas as questões respondidas existem no form
      const answeredQuestionIds = answers.map((a) => a.question_id);
      const invalidQuestions = answeredQuestionIds.filter(
        (id) => !questionIds.includes(id)
      );

      if (invalidQuestions.length > 0) {
        return res.status(400).json({
          error: `As seguintes questões não pertencem a este formulário: ${invalidQuestions.join(", ")}`,
        });
      }

      // Validar questões obrigatórias
      const missingRequired = requiredQuestions.filter(
        (id) => !answeredQuestionIds.includes(id)
      );

      if (missingRequired.length > 0) {
        return res.status(400).json({
          error: `As seguintes questões obrigatórias não foram respondidas: ${missingRequired.join(", ")}`,
        });
      }

      // Verificar se já existe um patient_form para este paciente e form
      let patientForm = await db("patient_forms")
        .where({ patient_id, id_form })
        .first();

      // Se não existe, criar um novo patient_form
      if (!patientForm) {
        const [newPatientForm] = await db("patient_forms")
          .insert({
            patient_id,
            id_form,
            filled_at: db.fn.now(),
            created_at: db.fn.now(),
            updated_at: db.fn.now(),
          })
          .returning("id_patient_form");

        patientForm = { id_patient_form: newPatientForm?.id_patient_form || newPatientForm };
      } else {
        // Atualizar o filled_at se já existe
        await db("patient_forms")
          .where({ id_patient_form: patientForm.id_patient_form })
          .update({
            filled_at: db.fn.now(),
            updated_at: db.fn.now(),
          });
      }

      const id_patient_form = patientForm.id_patient_form;

      // Preparar respostas em formato JSON
      const responsesData = {
        answers: answers.map((a) => ({
          question_id: a.question_id,
          answer: a.answer !== undefined ? String(a.answer) : null,
          comment: a.comment || null,
        })),
      };

      // Salvar respostas como JSON
      await db("patient_forms")
        .where({ id_patient_form })
        .update({
          responses: JSON.stringify(responsesData),
          updated_at: db.fn.now(),
        });

      // Buscar o patient_form completo
      const patientFormData = await db("patient_forms")
        .where({ id_patient_form })
        .first();

      // Parsear respostas JSON
      let responses = { answers: [] };
      if (patientFormData.responses) {
        try {
          responses = typeof patientFormData.responses === 'string' 
            ? JSON.parse(patientFormData.responses) 
            : patientFormData.responses;
        } catch (e) {
          console.error("Erro ao parsear responses:", e);
        }
      }

      return res.status(200).json({
        message: "Formulário respondido com sucesso!",
        patient_form: {
          id_patient_form: patientFormData.id_patient_form,
          patient_id: patientFormData.patient_id,
          id_form: patientFormData.id_form,
          filled_at: patientFormData.filled_at,
          created_at: patientFormData.created_at,
          updated_at: patientFormData.updated_at,
          answers: responses.answers || [],
        },
      });
    } catch (error) {
      console.error("Erro ao responder formulário:", error);
      return res.status(500).json({
        error: "Erro ao responder formulário.",
        details: error.message,
      });
    }
  },

  async getPatientForm(req, res) {
    try {
      const userId = req.user.user_id;
      const { patient_id, id_form } = req.params;

      // Verificar se o paciente existe e pertence ao usuário
      const patient = await db("patients")
        .where({ id: patient_id, user_id: userId })
        .first();

      if (!patient) {
        return res.status(404).json({
          error: "Paciente não encontrado ou sem permissão.",
        });
      }

      // Buscar o patient_form
      const patientForm = await db("patient_forms")
        .where({ patient_id, id_form })
        .first();

      if (!patientForm) {
        return res.status(404).json({
          error: "Formulário não preenchido para este paciente.",
        });
      }

      // Parsear respostas JSON
      let responses = { answers: [] };
      if (patientForm.responses) {
        try {
          responses = typeof patientForm.responses === 'string' 
            ? JSON.parse(patientForm.responses) 
            : patientForm.responses;
        } catch (e) {
          console.error("Erro ao parsear responses:", e);
        }
      }

      // Buscar informações do formulário
      const form = await db("forms")
        .where({ id_form, user_id: userId })
        .first();

      return res.status(200).json({
        id_patient_form: patientForm.id_patient_form,
        patient_id: patientForm.patient_id,
        id_form: patientForm.id_form,
        filled_at: patientForm.filled_at,
        created_at: patientForm.created_at,
        updated_at: patientForm.updated_at,
        form: form ? {
          id_form: form.id_form,
          name: form.name,
          description: form.description,
          type: form.type,
        } : null,
        answers: responses.answers || [],
      });
    } catch (error) {
      console.error("Erro ao buscar formulário preenchido:", error);
      return res.status(500).json({
        error: "Erro ao buscar formulário preenchido.",
        details: error.message,
      });
    }
  },

  async createForm(req, res) {
    try {
      const userId = req.user.user_id;
      const { name, description, type, form_structure } = req.body;

      // Validações
      if (!name || !name.trim()) {
        return res.status(400).json({
          error: "O campo 'name' é obrigatório.",
        });
      }

      if (!form_structure || !form_structure.questions || !Array.isArray(form_structure.questions)) {
        return res.status(400).json({
          error: "O campo 'form_structure' com 'questions' (array) é obrigatório.",
        });
      }

      // Validar e gerar IDs para questões sem ID
      const questions = form_structure.questions.map((q, index) => ({
        id: q.id || randomUUID(),
        question: q.question || "",
        answer_type: q.answer_type || "text",
        required: q.required || false,
        has_comment: q.has_comment || false,
        order: q.order !== undefined ? q.order : index,
      }));

      const structureToSave = {
        questions: questions,
      };

      // Criar formulário
      const [newForm] = await db("forms")
        .insert({
          user_id: userId,
          name: name.trim(),
          description: description || null,
          type: type || "anamnese",
          form_structure: JSON.stringify(structureToSave),
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        })
        .returning("*");

      return res.status(201).json({
        id_form: newForm.id_form,
        name: newForm.name,
        description: newForm.description,
        type: newForm.type,
        form_structure: structureToSave,
        created_at: newForm.created_at,
        updated_at: newForm.updated_at,
      });
    } catch (error) {
      console.error("Erro ao criar formulário:", error);
      return res.status(500).json({
        error: "Erro ao criar formulário.",
        details: error.message,
      });
    }
  },

  async updateForm(req, res) {
    try {
      const userId = req.user.user_id;
      const { id_form } = req.params;
      const { name, description, type, form_structure } = req.body;

      // Verificar se o formulário existe e pertence ao usuário
      const existingForm = await db("forms")
        .where({ id_form, user_id: userId })
        .first();

      if (!existingForm) {
        return res.status(404).json({
          error: "Formulário não encontrado.",
        });
      }

      // Preparar dados para atualização
      const updateData = {
        updated_at: db.fn.now(),
      };

      if (name !== undefined) {
        if (!name || !name.trim()) {
          return res.status(400).json({
            error: "O campo 'name' não pode ser vazio.",
          });
        }
        updateData.name = name.trim();
      }

      if (description !== undefined) {
        updateData.description = description || null;
      }

      if (type !== undefined) {
        updateData.type = type;
      }

      if (form_structure !== undefined) {
        if (!form_structure.questions || !Array.isArray(form_structure.questions)) {
          return res.status(400).json({
            error: "O campo 'form_structure' deve conter 'questions' (array).",
          });
        }

        // Validar e gerar IDs para questões sem ID
        const questions = form_structure.questions.map((q, index) => ({
          id: q.id || randomUUID(),
          question: q.question || "",
          answer_type: q.answer_type || "text",
          required: q.required || false,
          has_comment: q.has_comment || false,
          order: q.order !== undefined ? q.order : index,
        }));

        updateData.form_structure = JSON.stringify({
          questions: questions,
        });
      }

      // Atualizar formulário
      await db("forms")
        .where({ id_form, user_id: userId })
        .update(updateData);

      // Buscar formulário atualizado
      const updatedForm = await db("forms")
        .where({ id_form, user_id: userId })
        .first();

      // Parsear estrutura JSON
      let formStructure = { questions: [] };
      if (updatedForm.form_structure) {
        try {
          formStructure = typeof updatedForm.form_structure === 'string' 
            ? JSON.parse(updatedForm.form_structure) 
            : updatedForm.form_structure;
        } catch (e) {
          console.error("Erro ao parsear form_structure:", e);
        }
      }

      return res.status(200).json({
        id_form: updatedForm.id_form,
        name: updatedForm.name,
        description: updatedForm.description,
        type: updatedForm.type,
        form_structure: formStructure,
        created_at: updatedForm.created_at,
        updated_at: updatedForm.updated_at,
      });
    } catch (error) {
      console.error("Erro ao atualizar formulário:", error);
      return res.status(500).json({
        error: "Erro ao atualizar formulário.",
        details: error.message,
      });
    }
  },

  async deleteForm(req, res) {
    try {
      const userId = req.user.user_id;
      const { id_form } = req.params;

      // Verificar se o formulário existe e pertence ao usuário
      const form = await db("forms")
        .where({ id_form, user_id: userId })
        .first();

      if (!form) {
        return res.status(404).json({
          error: "Formulário não encontrado.",
        });
      }

      // Deletar formulário (cascade vai deletar patient_forms relacionados)
      await db("forms")
        .where({ id_form, user_id: userId })
        .delete();

      return res.status(200).json({
        message: "Formulário deletado com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao deletar formulário:", error);
      return res.status(500).json({
        error: "Erro ao deletar formulário.",
        details: error.message,
      });
    }
  },

  async duplicateForm(req, res) {
    try {
      const userId = req.user.user_id;
      const { id_form } = req.params;
      const { name } = req.body;

      // Buscar formulário original
      const originalForm = await db("forms")
        .where({ id_form, user_id: userId })
        .first();

      if (!originalForm) {
        return res.status(404).json({
          error: "Formulário não encontrado.",
        });
      }

      // Parsear estrutura JSON
      let formStructure = { questions: [] };
      if (originalForm.form_structure) {
        try {
          formStructure = typeof originalForm.form_structure === 'string' 
            ? JSON.parse(originalForm.form_structure) 
            : originalForm.form_structure;
        } catch (e) {
          console.error("Erro ao parsear form_structure:", e);
        }
      }

      // Gerar novos IDs para as questões
      const newQuestions = (formStructure.questions || []).map((q) => ({
        ...q,
        id: randomUUID(),
      }));

      const newStructure = {
        questions: newQuestions,
      };

      // Criar novo formulário
      const [duplicatedForm] = await db("forms")
        .insert({
          user_id: userId,
          name: name || `${originalForm.name} (Cópia)`,
          description: originalForm.description,
          type: originalForm.type,
          form_structure: JSON.stringify(newStructure),
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        })
        .returning("*");

      return res.status(201).json({
        id_form: duplicatedForm.id_form,
        name: duplicatedForm.name,
        description: duplicatedForm.description,
        type: duplicatedForm.type,
        form_structure: newStructure,
        created_at: duplicatedForm.created_at,
        updated_at: duplicatedForm.updated_at,
      });
    } catch (error) {
      console.error("Erro ao duplicar formulário:", error);
      return res.status(500).json({
        error: "Erro ao duplicar formulário.",
        details: error.message,
      });
    }
  },
};
