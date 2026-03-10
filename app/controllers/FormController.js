import db from "../database/index.js";

export default {
  async getFormById(req, res) {
    try {
      const { id_form } = req.params;

      // Buscar o form (compartilhado entre todos os usuários)
      const form = await db("forms")
        .where({ id_form })
        .first();

      if (!form) {
        return res.status(404).json({
          error: "Formulário não encontrado.",
        });
      }

      // Buscar as questões do form ordenadas por 'order'
      const questions = await db("form_questions")
        .where({ id_form })
        .orderBy("order", "asc")
        .orderBy("id_question", "asc");

      return res.status(200).json({
        id_form: form.id_form,
        name: form.name,
        description: form.description,
        type: form.type,
        created_at: form.created_at,
        updated_at: form.updated_at,
        questions: questions.map((q) => ({
          id_question: q.id_question,
          question: q.question,
          answer_type: q.answer_type,
          required: q.required,
          has_comment: q.has_comment || false,
          order: q.order,
          created_at: q.created_at,
          updated_at: q.updated_at,
        })),
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

      // Verificar se o form existe (compartilhado entre todos os usuários)
      const form = await db("forms")
        .where({ id_form })
        .first();

      if (!form) {
        return res.status(404).json({
          error: "Formulário não encontrado.",
        });
      }

      // Buscar todas as questões do form para validação
      const formQuestions = await db("form_questions")
        .where({ id_form })
        .select("id_question", "required");

      const questionIds = formQuestions.map((q) => q.id_question);
      const requiredQuestions = formQuestions
        .filter((q) => q.required)
        .map((q) => q.id_question);

      // Validar que todas as questões respondidas existem no form
      const answeredQuestionIds = answers.map((a) => a.id_question);
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

      // Processar cada resposta
      for (const answerData of answers) {
        const { id_question, answer, comment } = answerData;

        // Verificar se já existe uma resposta para esta questão
        const existingAnswer = await db("patient_form_answers")
          .where({
            id_patient_form,
            id_question,
          })
          .first();

        if (existingAnswer) {
          // Atualizar resposta existente
          await db("patient_form_answers")
            .where({ id_answer: existingAnswer.id_answer })
            .update({
              answer: answer !== undefined ? answer : null,
              comment: comment !== undefined ? comment : null,
              updated_at: db.fn.now(),
            });
        } else {
          // Criar nova resposta
          await db("patient_form_answers").insert({
            id_patient_form,
            id_question,
            answer: answer !== undefined ? answer : null,
            comment: comment !== undefined ? comment : null,
            created_at: db.fn.now(),
            updated_at: db.fn.now(),
          });
        }
      }

      // Buscar o patient_form completo com todas as respostas
      const patientFormData = await db("patient_forms")
        .where({ id_patient_form })
        .first();

      const formAnswers = await db("patient_form_answers")
        .where({ id_patient_form })
        .select("*");

      return res.status(200).json({
        message: "Formulário respondido com sucesso!",
        patient_form: {
          id_patient_form: patientFormData.id_patient_form,
          patient_id: patientFormData.patient_id,
          id_form: patientFormData.id_form,
          filled_at: patientFormData.filled_at,
          created_at: patientFormData.created_at,
          updated_at: patientFormData.updated_at,
          answers: formAnswers.map((a) => ({
            id_answer: a.id_answer,
            id_question: a.id_question,
            answer: a.answer,
            comment: a.comment,
            created_at: a.created_at,
            updated_at: a.updated_at,
          })),
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

      // Buscar todas as respostas do formulário
      const answers = await db("patient_form_answers")
        .where({ id_patient_form: patientForm.id_patient_form })
        .select("*");

      // Buscar informações do formulário
      const form = await db("forms")
        .where({ id_form })
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
        answers: answers.map((a) => ({
          id_answer: a.id_answer,
          id_question: a.id_question,
          answer: a.answer,
          comment: a.comment,
          created_at: a.created_at,
          updated_at: a.updated_at,
        })),
      });
    } catch (error) {
      console.error("Erro ao buscar formulário preenchido:", error);
      return res.status(500).json({
        error: "Erro ao buscar formulário preenchido.",
        details: error.message,
      });
    }
  },
};
