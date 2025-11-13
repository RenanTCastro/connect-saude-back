import db from "../database/index.js";

export default {
  async createSalesStage(req, res) {
    try {
      const { name, order_position } = req.body;
      const userId = req.user.user_id;

      if (!name || order_position === undefined) {
        return res.status(400).json({
          error: "É necessário informar o nome e a posição de ordem do estágio de venda.",
        });
      }

      await db("sales_stages").insert({
        user_id: userId,
        name,
        order_position,
        created_at: db.fn.now(),
      });

      return res.status(201).json({ message: "Estágio de venda criado com sucesso!" });
    } catch (error) {
      console.error("Erro ao criar estágio de venda:", error);
      return res.status(500).json({
        error: "Erro ao criar estágio de venda.",
        details: error.message,
      });
    }
  },

  async getSalesStages(req, res) {
    try {
      const userId = req.user.user_id;

      const stages = await db("sales_stages")
        .select("*")
        .where({ user_id: userId })
        .orderBy("order_position", "asc");

      // Get opportunity count for each stage
      const stagesWithCounts = await Promise.all(
        stages.map(async (stage) => {
          const count = await db("sales_opportunities")
            .where({ stage_id: stage.id, user_id: userId })
            .count("* as count")
            .first();

          const countValue = count?.count || count?.['count(*)'] || 0;
          return {
            ...stage,
            opportunities_count: parseInt(countValue),
          };
        })
      );

      return res.status(200).json(stagesWithCounts);
    } catch (error) {
      console.error("Erro ao buscar estágios de venda:", error);
      return res.status(500).json({
        error: "Erro ao buscar estágios de venda.",
        details: error.message,
      });
    }
  },

  async updateSalesStage(req, res) {
    try {
      const { id } = req.params;
      const { name, order_position } = req.body;
      const userId = req.user.user_id;

      if (!name && order_position === undefined) {
        return res.status(400).json({
          error: "É necessário informar o nome e/ou a posição de ordem para atualização.",
        });
      }

      const updateData = {};
      if (name) updateData.name = name;
      if (order_position !== undefined) updateData.order_position = order_position;

      const updated = await db("sales_stages")
        .where({ id, user_id: userId })
        .update(updateData);

      if (updated === 0) {
        return res.status(404).json({
          error: "Estágio de venda não encontrado ou sem permissão.",
        });
      }

      return res.status(200).json({ message: "Estágio de venda atualizado com sucesso!" });
    } catch (error) {
      console.error("Erro ao atualizar estágio de venda:", error);
      return res.status(500).json({
        error: "Erro ao atualizar estágio de venda.",
        details: error.message,
      });
    }
  },

  async deleteSalesStage(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.user_id;

      // Check if stage exists and belongs to user
      const stage = await db("sales_stages")
        .where({ id, user_id: userId })
        .first();

      if (!stage) {
        return res.status(404).json({
          error: "Estágio de venda não encontrado ou sem permissão.",
        });
      }

      // Check if stage has opportunities
      const opportunitiesCount = await db("sales_opportunities")
        .where({ stage_id: id, user_id: userId })
        .count("* as count")
        .first();

      const countValue = opportunitiesCount?.count || opportunitiesCount?.['count(*)'] || 0;
      if (parseInt(countValue) > 0) {
        return res.status(400).json({
          error: "Não é possível excluir o estágio pois ele possui oportunidades associadas. Mova ou exclua as oportunidades primeiro.",
        });
      }

      const deleted = await db("sales_stages")
        .where({ id, user_id: userId })
        .del();

      if (deleted === 0) {
        return res.status(404).json({
          error: "Estágio de venda não encontrado ou sem permissão.",
        });
      }

      return res.status(200).json({ message: "Estágio de venda removido com sucesso!" });
    } catch (error) {
      console.error("Erro ao excluir estágio de venda:", error);
      return res.status(500).json({
        error: "Erro ao excluir estágio de venda.",
        details: error.message,
      });
    }
  },

  async createSalesOpportunity(req, res) {
    try {
      const {
        patient_id,
        stage_id,
        title,
        description,
        estimated_value,
        label,
        contact_date,
        next_action_date,
      } = req.body;
      const userId = req.user.user_id;

      if (!title || !stage_id) {
        return res.status(400).json({
          error: "É necessário informar o título e o estágio da oportunidade de venda.",
        });
      }

      const stage = await db("sales_stages")
        .where({ id: stage_id, user_id: userId })
        .first();

      if (!stage) {
        return res.status(404).json({
          error: "Estágio de venda não encontrado ou sem permissão.",
        });
      }

      if (patient_id) {
        const patient = await db("patients")
          .where({ id: patient_id, user_id: userId })
          .first();

        if (!patient) {
          return res.status(404).json({
            error: "Paciente não encontrado ou sem permissão.",
          });
        }
      }

      if (label) {
        const labelExists = await db("labels")
          .where({ name: label, user_id: userId, is_active: true })
          .first();

        if (!labelExists) {
          return res.status(404).json({
            error: "Rótulo não encontrado ou inativo. Por favor, crie o rótulo antes de usá-lo.",
          });
        }
      }

      await db("sales_opportunities").insert({
        user_id: userId,
        patient_id: patient_id || null,
        stage_id,
        title,
        description: description || null,
        estimated_value: estimated_value || null,
        label: label || null,
        contact_date: contact_date || null,
        next_action_date: next_action_date || null,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      });

      return res.status(201).json({ message: "Oportunidade de venda criada com sucesso!" });
    } catch (error) {
      console.error("Erro ao criar oportunidade de venda:", error);
      return res.status(500).json({
        error: "Erro ao criar oportunidade de venda.",
        details: error.message,
      });
    }
  },

  async getSalesOpportunities(req, res) {
    try {
      const { stage_id, title } = req.query;
      const userId = req.user.user_id;

      let query = db("sales_opportunities")
        .select(
          "sales_opportunities.*",
          "patients.full_name as patient_name",
          "sales_stages.name as stage_name",
          "sales_stages.order_position as stage_order"
        )
        .leftJoin("patients", "sales_opportunities.patient_id", "patients.id")
        .leftJoin("sales_stages", "sales_opportunities.stage_id", "sales_stages.id")
        .where("sales_opportunities.user_id", userId)
        .orderBy("sales_opportunities.created_at", "desc");

      if (stage_id) {
        query = query.andWhere("sales_opportunities.stage_id", stage_id);
      }

      if (title) {
        query = query.andWhereILike("sales_opportunities.title", `%${title}%`);
      }

      const opportunities = await query;

      // Get notes count for each opportunity
      const opportunitiesWithCounts = await Promise.all(
        opportunities.map(async (opportunity) => {
          const notesCount = await db("sales_notes")
            .where({ opportunity_id: opportunity.id })
            .count("* as count")
            .first();

          const countValue = notesCount?.count || notesCount?.['count(*)'] || 0;
          return {
            ...opportunity,
            notes_count: parseInt(countValue),
          };
        })
      );

      return res.status(200).json(opportunitiesWithCounts);
    } catch (error) {
      console.error("Erro ao buscar oportunidades de venda:", error);
      return res.status(500).json({
        error: "Erro ao buscar oportunidades de venda.",
        details: error.message,
      });
    }
  },

  async getSalesOpportunityById(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.user_id;

      const opportunity = await db("sales_opportunities")
        .select(
          "sales_opportunities.*",
          "patients.full_name as patient_name",
          "patients.phone as patient_phone",
          "sales_stages.name as stage_name",
          "sales_stages.order_position as stage_order"
        )
        .leftJoin("patients", "sales_opportunities.patient_id", "patients.id")
        .leftJoin("sales_stages", "sales_opportunities.stage_id", "sales_stages.id")
        .where("sales_opportunities.id", id)
        .where("sales_opportunities.user_id", userId)
        .first();

      if (!opportunity) {
        return res.status(404).json({
          error: "Oportunidade de venda não encontrada ou sem permissão.",
        });
      }

      return res.status(200).json(opportunity);
    } catch (error) {
      console.error("Erro ao buscar oportunidade de venda:", error);
      return res.status(500).json({
        error: "Erro ao buscar oportunidade de venda.",
        details: error.message,
      });
    }
  },

  async updateSalesOpportunity(req, res) {
    try {
      const { id } = req.params;
      const {
        patient_id,
        stage_id,
        title,
        description,
        estimated_value,
        label,
        contact_date,
        next_action_date,
      } = req.body;
      const userId = req.user.user_id;

      // Check if opportunity exists and belongs to user
      const opportunity = await db("sales_opportunities")
        .where({ id, user_id: userId })
        .first();

      if (!opportunity) {
        return res.status(404).json({
          error: "Oportunidade de venda não encontrada ou sem permissão.",
        });
      }

      // Validate stage_id if provided
      if (stage_id !== undefined) {
        const stage = await db("sales_stages")
          .where({ id: stage_id, user_id: userId })
          .first();

        if (!stage) {
          return res.status(404).json({
            error: "Estágio de venda não encontrado ou sem permissão.",
          });
        }
      }

      // Validate patient_id if provided
      if (patient_id !== undefined && patient_id !== null) {
        const patient = await db("patients")
          .where({ id: patient_id, user_id: userId })
          .first();

        if (!patient) {
          return res.status(404).json({
            error: "Paciente não encontrado ou sem permissão.",
          });
        }
      }

      // Validate label if provided
      if (label !== undefined && label !== null) {
        const labelExists = await db("labels")
          .where({ name: label, user_id: userId, is_active: true })
          .first();

        if (!labelExists) {
          return res.status(404).json({
            error: "Rótulo não encontrado ou inativo. Por favor, crie o rótulo antes de usá-lo.",
          });
        }
      }

      const updateData = {};
      if (patient_id !== undefined) updateData.patient_id = patient_id;
      if (stage_id !== undefined) updateData.stage_id = stage_id;
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (estimated_value !== undefined) updateData.estimated_value = estimated_value;
      if (label !== undefined) updateData.label = label;
      if (contact_date !== undefined) updateData.contact_date = contact_date;
      if (next_action_date !== undefined) updateData.next_action_date = next_action_date;
      updateData.updated_at = db.fn.now();

      await db("sales_opportunities")
        .where({ id, user_id: userId })
        .update(updateData);

      return res.status(200).json({ message: "Oportunidade de venda atualizada com sucesso!" });
    } catch (error) {
      console.error("Erro ao atualizar oportunidade de venda:", error);
      return res.status(500).json({
        error: "Erro ao atualizar oportunidade de venda.",
        details: error.message,
      });
    }
  },

  async deleteSalesOpportunity(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.user_id;

      // Verificar se a oportunidade existe e pertence ao usuário
      const opportunity = await db("sales_opportunities")
        .where({ id, user_id: userId })
        .first();

      if (!opportunity) {
        return res.status(404).json({
          error: "Oportunidade de venda não encontrada ou sem permissão.",
        });
      }

      // Primeiro, excluir todas as notas relacionadas à oportunidade
      await db("sales_notes")
        .where({ opportunity_id: id })
        .del();

      // Depois, excluir a oportunidade
      const deleted = await db("sales_opportunities")
        .where({ id, user_id: userId })
        .del();

      if (deleted === 0) {
        return res.status(404).json({
          error: "Oportunidade de venda não encontrada ou sem permissão.",
        });
      }

      return res.status(200).json({ message: "Oportunidade de venda removida com sucesso!" });
    } catch (error) {
      console.error("Erro ao excluir oportunidade de venda:", error);
      return res.status(500).json({
        error: "Erro ao excluir oportunidade de venda.",
        details: error.message,
      });
    }
  },

  async createSalesNote(req, res) {
    try {
      const { opportunity_id, content } = req.body;
      const userId = req.user.user_id;

      if (!opportunity_id || !content) {
        return res.status(400).json({
          error: "É necessário informar o ID da oportunidade e o conteúdo da nota.",
        });
      }

      const opportunity = await db("sales_opportunities")
        .where({ id: opportunity_id, user_id: userId })
        .first();

      if (!opportunity) {
        return res.status(404).json({
          error: "Oportunidade de venda não encontrada ou sem permissão.",
        });
      }

      await db("sales_notes").insert({
        opportunity_id,
        user_id: userId,
        content,
        created_at: db.fn.now(),
      });

      return res.status(201).json({ message: "Nota criada com sucesso!" });
    } catch (error) {
      console.error("Erro ao criar nota:", error);
      return res.status(500).json({
        error: "Erro ao criar nota.",
        details: error.message,
      });
    }
  },

  async getSalesNotes(req, res) {
    try {
      const { opportunity_id } = req.params;
      const userId = req.user.user_id;

      // Verify that the opportunity belongs to the user
      const opportunity = await db("sales_opportunities")
        .where({ id: opportunity_id, user_id: userId })
        .first();

      if (!opportunity) {
        return res.status(404).json({
          error: "Oportunidade de venda não encontrada ou sem permissão.",
        });
      }

      const notes = await db("sales_notes")
        .select(
          "sales_notes.*",
          "users.name as user_name"
        )
        .leftJoin("users", "sales_notes.user_id", "users.id")
        .where({ opportunity_id })
        .orderBy("sales_notes.created_at", "desc");

      return res.status(200).json(notes);
    } catch (error) {
      console.error("Erro ao buscar notas:", error);
      return res.status(500).json({
        error: "Erro ao buscar notas.",
        details: error.message,
      });
    }
  },

  async updateSalesNote(req, res) {
    try {
      const { id } = req.params;
      const { content } = req.body;
      const userId = req.user.user_id;

      if (!content) {
        return res.status(400).json({
          error: "É necessário informar o conteúdo da nota para atualização.",
        });
      }

      // Check if note exists and belongs to user
      const note = await db("sales_notes")
        .where({ id, user_id: userId })
        .first();

      if (!note) {
        return res.status(404).json({
          error: "Nota não encontrada ou sem permissão.",
        });
      }

      await db("sales_notes")
        .where({ id, user_id: userId })
        .update({ content });

      return res.status(200).json({ message: "Nota atualizada com sucesso!" });
    } catch (error) {
      console.error("Erro ao atualizar nota:", error);
      return res.status(500).json({
        error: "Erro ao atualizar nota.",
        details: error.message,
      });
    }
  },

  async deleteSalesNote(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.user_id;

      const deleted = await db("sales_notes")
        .where({ id, user_id: userId })
        .del();

      if (deleted === 0) {
        return res.status(404).json({
          error: "Nota não encontrada ou sem permissão.",
        });
      }

      return res.status(200).json({ message: "Nota removida com sucesso!" });
    } catch (error) {
      console.error("Erro ao excluir nota:", error);
      return res.status(500).json({
        error: "Erro ao excluir nota.",
        details: error.message,
      });
    }
  },
};

