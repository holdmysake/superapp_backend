import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'
import Trunkline from './trunkline.model.js'

const MLNew = sequelize.define('ml_new', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    ml_id: {
        type: DataTypes.STRING(15),
        allowNull: false,
        unique: true,
    },
    ml_name: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    tline_id: {
        type: DataTypes.STRING,
        allowNull: true,
        references: {
            model: Trunkline,
            key: 'tline_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    },
    ml_url: {
        type: DataTypes.STRING(255),
        allowNull: false
    }
}, {
    tableName: 'ml_new',
    timestamps: false,
    underscored: true
})

export default MLNew